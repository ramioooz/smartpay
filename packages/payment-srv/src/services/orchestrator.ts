import { Prisma, PaymentStatus as PrismaPaymentStatus } from '../../node_modules/.prisma/payment-client';
import {
  CreatePaymentRequest,
  createKafkaClient,
  FXQuote,
  IdempotencyStore,
  KafkaProducer,
  PaymentStatus,
  PSPAdapter,
  RoutingDecision,
  TOPICS,
  createLogger,
} from '@smartpay/shared';
import { config } from '../config';
import { pspAdapterRegistry } from '../adapters/registry';
import { prisma } from './prisma';
import { getRedisClient } from './redis';
import { fxClient, routingClient } from './http';
import { appendTransactionLog } from './transaction-log';
import { executeFailureCompensation } from './saga';
import { publishMerchantWebhook } from './webhook-dispatch';

const logger = createLogger({ service: 'payment-srv', component: 'orchestrator' });

export type CreatePaymentResult = {
  id: string;
  status: PaymentStatus;
  pspName?: string;
  pspTransactionId?: string;
  fxQuoteId?: string;
  targetAmount?: number;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
};

const fallbackRoutingOrder = ['stripe', 'wise', 'checkout', 'crypto-rail'];

class PaymentOrchestrator {
  private readonly idempotencyStore = new IdempotencyStore(getRedisClient());
  private kafkaProducer: KafkaProducer | null = null;

  async connect(): Promise<void> {
    const kafka = createKafkaClient('payment-srv-orchestrator', config.kafkaBrokers);
    this.kafkaProducer = new KafkaProducer(kafka.producer());
    await this.kafkaProducer.connect();
  }

  async disconnect(): Promise<void> {
    if (!this.kafkaProducer) {
      return;
    }

    await this.kafkaProducer.disconnect();
    this.kafkaProducer = null;
  }

  async createPayment(input: CreatePaymentRequest, correlationId: string): Promise<CreatePaymentResult> {
    const idempotencyKey = `${input.merchantId}:${input.externalRef}`;
    const lockOwner = `${correlationId}:${Date.now()}`;
    const lockAcquired = await this.idempotencyStore.acquireLock(
      idempotencyKey,
      lockOwner,
      config.IDEMPOTENCY_LOCK_TTL_SECONDS,
    );

    if (!lockAcquired) {
      const existingPayment = await prisma.payment.findUnique({
        where: { idempotencyKey },
      });

      if (existingPayment) {
        return this.toCreateResult(existingPayment);
      }

      throw new Error(
        `Payment ${input.externalRef} is already being processed for merchant ${input.merchantId}`,
      );
    }

    const initial = await this.createInitialPayment(input, idempotencyKey, correlationId);
    let payment = initial.payment;

    if (!initial.created) {
      return this.toCreateResult(payment);
    }

    try {
      const routing = await this.resolveRoutingDecision(payment.id, input, correlationId);
      const quote = await this.resolveFxQuote(input, correlationId);
      const adapters = this.resolveRankedAdapters(routing);

      for (const adapter of adapters) {
        const submission = await this.trySubmitWithAdapter(payment.id, input, quote, adapter, correlationId);
        if (submission.settledPayment) {
          return this.toCreateResult(submission.settledPayment);
        }
      }

      payment = await this.markPaymentFailed(payment.id, 'All configured PSP adapters failed', correlationId);
      await executeFailureCompensation(payment.id, correlationId, [
        {
          name: 'release_fx_quote_lock',
          run: async () => {
            // FIXME: integrate with FX quote reservation release once fx-srv lock API is available.
          },
        },
      ]);

      await this.publishEvent(TOPICS.PAYMENT_FAILED, {
        paymentId: payment.id,
        pspName: payment.pspName,
        reason: payment.failureReason,
        willRetry: false,
        timestamp: new Date().toISOString(),
      }, correlationId);

      await publishMerchantWebhook(
        {
          type: 'payment.failed',
          merchantId: input.merchantId,
          paymentId: payment.id,
          reason: payment.failureReason,
          timestamp: new Date().toISOString(),
        },
        correlationId,
      );

      return this.toCreateResult(payment);
    } finally {
      await this.idempotencyStore.releaseLock(idempotencyKey);
    }
  }

  async getPaymentById(id: string): Promise<CreatePaymentResult | null> {
    const payment = await prisma.payment.findUnique({ where: { id } });
    return payment ? this.toCreateResult(payment) : null;
  }

  async initiateRefund(paymentId: string, amount: number, correlationId: string): Promise<CreatePaymentResult> {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new Error(`Payment ${paymentId} was not found`);
    }

    if (!payment.pspName || !payment.pspTransactionId) {
      throw new Error(`Payment ${paymentId} has no PSP transaction reference for refund`);
    }

    const adapter = pspAdapterRegistry.resolveAdapter(payment.pspName);
    if (!adapter) {
      throw new Error(`PSP adapter ${payment.pspName} is not registered for refunds`);
    }

    const response = await adapter.initiateRefund(payment.pspTransactionId, amount);
    if (!response.success) {
      throw new Error(`Refund failed for payment ${paymentId} via PSP ${payment.pspName}`);
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PrismaPaymentStatus.REFUND_INITIATED,
      },
    });

    await appendTransactionLog({
      paymentId,
      event: 'refund.initiated',
      fromStatus: payment.status,
      toStatus: PrismaPaymentStatus.REFUND_INITIATED,
      pspName: payment.pspName,
      correlationId,
      response: {
        refundId: response.refundId,
      },
    });

    return this.toCreateResult(updated);
  }

  private async createInitialPayment(
    input: CreatePaymentRequest,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<{
    payment: Awaited<ReturnType<typeof prisma.payment.findUniqueOrThrow>>;
    created: boolean;
  }> {
    try {
      const payment = await prisma.payment.create({
        data: {
          merchantId: input.merchantId,
          externalRef: input.externalRef,
          amount: new Prisma.Decimal(input.amount),
          currency: input.currency,
          targetCurrency: input.targetCurrency,
          beneficiaryName: input.beneficiary.name,
          beneficiaryCountry: input.beneficiary.country,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
          idempotencyKey,
          status: PrismaPaymentStatus.INITIATED,
        },
      });

      await appendTransactionLog({
        paymentId: payment.id,
        event: 'status.change',
        toStatus: PrismaPaymentStatus.INITIATED,
        correlationId,
      });

      await this.publishEvent(TOPICS.PAYMENT_CREATED, {
        paymentId: payment.id,
        merchantId: input.merchantId,
        amount: input.amount,
        currency: input.currency,
        targetCurrency: input.targetCurrency,
        timestamp: new Date().toISOString(),
      }, correlationId);

      return { payment, created: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existingPayment = await prisma.payment.findUnique({
          where: { idempotencyKey },
        });

        if (existingPayment) {
          return { payment: existingPayment, created: false };
        }
      }

      throw error;
    }
  }

  private async resolveRoutingDecision(
    paymentId: string,
    input: CreatePaymentRequest,
    correlationId: string,
  ): Promise<RoutingDecision> {
    await prisma.payment.updateMany({
      where: { id: paymentId, status: PrismaPaymentStatus.INITIATED },
      data: { status: PrismaPaymentStatus.ROUTING },
    });

    try {
      const response = await routingClient.post(`${config.ROUTING_SRV_URL}/route`, {
        paymentId,
        merchantId: input.merchantId,
        amount: input.amount,
        currency: input.currency,
        targetCurrency: input.targetCurrency,
        beneficiaryCountry: input.beneficiary.country,
      },
      {
        headers: { 'x-request-id': correlationId },
      },
      );

      if (response.status >= 200 && response.status < 300 && response.data) {
        return response.data as RoutingDecision;
      }
    } catch (error) {
      logger.warn({ error, paymentId }, 'Routing call failed, falling back to local adapter order');
    }

    // TODO: replace fallback routing with strict failure once routing-srv is fully online.
    const selectedPSP = fallbackRoutingOrder[0];
    return {
      paymentId,
      selectedPSP,
      reason: 'Routing service unavailable, using fallback ordering',
      rankedPSPs: fallbackRoutingOrder.map((pspName, index) => ({
        pspName,
        score: 100 - index,
        factors: {
          costScore: 0,
          latencyScore: 0,
          successRateScore: 0,
          currencySupport: true,
          countrySupport: true,
        },
      })),
    };
  }

  private async resolveFxQuote(
    input: CreatePaymentRequest,
    correlationId: string,
  ): Promise<FXQuote> {
    const pair = `${input.currency}-${input.targetCurrency}`;
    try {
      const response = await fxClient.post(`${config.FX_SRV_URL}/rates/quote`, {
        pair,
        sourceAmount: input.amount,
        merchantId: input.merchantId,
      });

      if (response.status >= 200 && response.status < 300 && response.data) {
        return response.data as FXQuote;
      }
    } catch (error) {
      logger.warn({ error, pair, correlationId }, 'FX quote call failed, using fallback quote');
    }

    logger.warn({ pair, correlationId }, 'FX quote service unavailable, applying fallback 1:1 quote');

    return {
      quoteId: `fallback-${Date.now()}`,
      pair,
      rate: 1,
      spread: 0,
      sourceAmount: input.amount,
      targetAmount: input.amount,
      expiresAt: new Date(Date.now() + 30_000),
    };
  }

  private resolveRankedAdapters(routing: RoutingDecision): PSPAdapter[] {
    const adapterNames = [routing.selectedPSP, ...routing.rankedPSPs.map((item) => item.pspName)];

    const unique = new Set<string>();
    const resolved: PSPAdapter[] = [];

    for (const name of adapterNames) {
      if (!name || unique.has(name)) {
        continue;
      }

      unique.add(name);
      const adapter = pspAdapterRegistry.resolveAdapter(name);
      if (adapter) {
        resolved.push(adapter);
      }
    }

    return resolved;
  }

  private async trySubmitWithAdapter(
    paymentId: string,
    input: CreatePaymentRequest,
    quote: FXQuote,
    adapter: PSPAdapter,
    correlationId: string,
  ): Promise<{ settledPayment?: Awaited<ReturnType<typeof prisma.payment.findUniqueOrThrow>> }> {
    const startedAt = Date.now();

    await prisma.payment.updateMany({
      where: { id: paymentId, status: PrismaPaymentStatus.ROUTING },
      data: { status: PrismaPaymentStatus.ROUTED, pspName: adapter.name },
    });

    const paymentBeforeSubmission = await prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });

    if (new Date() >= quote.expiresAt) {
      quote = await this.resolveFxQuote(input, correlationId);
    }

    const submitResponse = await adapter.submitPayment({
      paymentId,
      amount: input.amount,
      currency: input.currency,
      targetCurrency: input.targetCurrency,
      targetAmount: quote.targetAmount,
      beneficiary: {
        name: input.beneficiary.name,
        accountNumber: input.beneficiary.accountNumber,
        iban: input.beneficiary.iban,
        bankCode: input.beneficiary.bankCode,
        country: input.beneficiary.country,
      },
    });

    await appendTransactionLog({
      paymentId,
      event: 'psp.submit',
      fromStatus: paymentBeforeSubmission.status,
      toStatus: submitResponse.success ? PrismaPaymentStatus.SUBMITTED : PrismaPaymentStatus.FAILED,
      pspName: adapter.name,
      durationMs: Date.now() - startedAt,
      correlationId,
      request: {
        amount: input.amount,
        currency: input.currency,
        targetCurrency: input.targetCurrency,
      },
      response: {
        success: submitResponse.success,
        status: submitResponse.status,
        message: submitResponse.message,
      },
    });

    if (!submitResponse.success) {
      return {};
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PrismaPaymentStatus.SETTLED,
          pspName: adapter.name,
          pspTransactionId: submitResponse.pspTransactionId,
          targetAmount: new Prisma.Decimal(quote.targetAmount),
          fxRate: new Prisma.Decimal(quote.rate),
          fxQuoteId: quote.quoteId,
          settledAt: new Date(),
        },
      });

      await tx.ledgerEntry.createMany({
        data: [
          {
            paymentId,
            type: 'DEBIT',
            amount: new Prisma.Decimal(input.amount),
            currency: input.currency,
            pspName: adapter.name,
            description: 'Payment submission debit',
          },
          {
            paymentId,
            type: 'CREDIT',
            amount: new Prisma.Decimal(quote.targetAmount),
            currency: input.targetCurrency,
            pspName: adapter.name,
            description: 'Settled amount credit',
          },
        ],
      });

      return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    });

    await this.publishEvent(TOPICS.PAYMENT_SETTLED, {
      paymentId,
      pspName: adapter.name,
      pspTransactionId: submitResponse.pspTransactionId,
      settledAmount: quote.targetAmount,
      settledCurrency: input.targetCurrency,
      timestamp: new Date().toISOString(),
    }, correlationId);

    await publishMerchantWebhook(
      {
        type: 'payment.settled',
        merchantId: input.merchantId,
        paymentId,
        pspName: adapter.name,
        timestamp: new Date().toISOString(),
      },
      correlationId,
    );

    return { settledPayment: result };
  }

  private async markPaymentFailed(paymentId: string, reason: string, correlationId: string) {
    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PrismaPaymentStatus.FAILED,
        failureReason: reason,
      },
    });

    await appendTransactionLog({
      paymentId,
      event: 'status.change',
      fromStatus: PrismaPaymentStatus.ROUTED,
      toStatus: PrismaPaymentStatus.FAILED,
      correlationId,
      error: reason,
    });

    return updated;
  }

  private async publishEvent(topic: string, payload: Record<string, unknown>, correlationId: string) {
    if (!this.kafkaProducer) {
      return;
    }

    await this.kafkaProducer.publish(topic, payload, { correlationId });
  }

  private toCreateResult(
    payment: Awaited<ReturnType<typeof prisma.payment.findUniqueOrThrow>>,
  ): CreatePaymentResult {
    return {
      id: payment.id,
      status: payment.status as PaymentStatus,
      pspName: payment.pspName ?? undefined,
      pspTransactionId: payment.pspTransactionId ?? undefined,
      fxQuoteId: payment.fxQuoteId ?? undefined,
      targetAmount: payment.targetAmount ? Number(payment.targetAmount) : undefined,
      failureReason: payment.failureReason ?? undefined,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}

export const paymentOrchestrator = new PaymentOrchestrator();
