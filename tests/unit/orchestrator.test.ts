const acquireLockMock = jest.fn();
const releaseLockMock = jest.fn();
const loggerInfoMock = jest.fn();
const loggerWarnMock = jest.fn();
const loggerErrorMock = jest.fn();

jest.mock('@smartpay/shared', () => {
  const actual = jest.requireActual('@smartpay/shared');
  return {
    ...actual,
    createLogger: jest.fn(() => ({
      info: loggerInfoMock,
      warn: loggerWarnMock,
      error: loggerErrorMock,
    })),
    createKafkaClient: jest.fn(() => ({
      producer: () => ({}),
    })),
    KafkaProducer: jest.fn().mockImplementation(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      publish: jest.fn(),
    })),
    IdempotencyStore: jest.fn().mockImplementation(() => ({
      acquireLock: acquireLockMock,
      releaseLock: releaseLockMock,
    })),
  };
});

const prismaMock = {
  payment: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  ledgerEntry: {
    createMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const routingPostMock = jest.fn();
const fxPostMock = jest.fn();
const appendTransactionLogMock = jest.fn();
const executeFailureCompensationMock = jest.fn();
const publishMerchantWebhookMock = jest.fn();
const resolveAdapterMock = jest.fn();

jest.mock('../../packages/payment-srv/src/services/prisma', () => ({
  prisma: prismaMock,
}));

jest.mock('../../packages/payment-srv/src/config', () => ({
  config: {
    ROUTING_SRV_URL: 'http://routing-srv:3004',
    FX_SRV_URL: 'http://fx-srv:3002',
    kafkaBrokers: ['kafka:29092'],
    IDEMPOTENCY_LOCK_TTL_SECONDS: 30,
  },
}));

jest.mock('../../packages/payment-srv/src/services/redis', () => ({
  getRedisClient: jest.fn(() => ({})),
}));

jest.mock('../../packages/payment-srv/src/services/http', () => ({
  routingClient: { post: routingPostMock },
  fxClient: { post: fxPostMock },
}));

jest.mock('../../packages/payment-srv/src/services/transaction-log', () => ({
  appendTransactionLog: appendTransactionLogMock,
}));

jest.mock('../../packages/payment-srv/src/services/saga', () => ({
  executeFailureCompensation: executeFailureCompensationMock,
}));

jest.mock('../../packages/payment-srv/src/services/webhook-dispatch', () => ({
  publishMerchantWebhook: publishMerchantWebhookMock,
}));

jest.mock('../../packages/payment-srv/src/adapters/registry', () => ({
  pspAdapterRegistry: {
    resolveAdapter: resolveAdapterMock,
  },
}));

import { paymentOrchestrator } from '../../packages/payment-srv/src/services/orchestrator';

type PaymentLike = {
  id: string;
  merchantId: string;
  externalRef: string;
  amount: number;
  currency: string;
  targetCurrency: string;
  status: string;
  pspName?: string | null;
  pspTransactionId?: string | null;
  fxQuoteId?: string | null;
  targetAmount?: number | null;
  failureReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function paymentFixture(partial: Partial<PaymentLike> = {}): PaymentLike {
  return {
    id: 'payment-1',
    merchantId: 'merchant-1',
    externalRef: 'order-1',
    amount: 100,
    currency: 'USD',
    targetCurrency: 'EUR',
    status: 'INITIATED',
    pspName: null,
    pspTransactionId: null,
    fxQuoteId: null,
    targetAmount: null,
    failureReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...partial,
  };
}

describe('orchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns existing payment when idempotency lock is already held', async () => {
    acquireLockMock.mockResolvedValue(false);
    prismaMock.payment.findUnique.mockResolvedValue(
      paymentFixture({
        id: 'payment-existing',
        status: 'SUBMITTED',
      }),
    );

    const result = await paymentOrchestrator.createPayment(
      {
        merchantId: 'merchant-1',
        externalRef: 'order-1',
        amount: 250,
        currency: 'USD',
        targetCurrency: 'EUR',
        beneficiary: {
          name: 'John Doe',
          country: 'DE',
        },
      },
      'req-1',
    );

    expect(result.id).toBe('payment-existing');
    expect(result.status).toBe('SUBMITTED');
    expect(releaseLockMock).not.toHaveBeenCalled();
  });

  it('runs compensation and marks payment failed when all adapters fail submission', async () => {
    acquireLockMock.mockResolvedValue(true);
    prismaMock.payment.create.mockResolvedValue(paymentFixture({ id: 'payment-fail', status: 'INITIATED' }));
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.payment.findUniqueOrThrow.mockResolvedValue(paymentFixture({ id: 'payment-fail', status: 'ROUTED' }));
    prismaMock.payment.update.mockResolvedValue(paymentFixture({
      id: 'payment-fail',
      status: 'FAILED',
      failureReason: 'All configured PSP adapters failed',
    }));
    appendTransactionLogMock.mockResolvedValue(undefined);
    routingPostMock.mockResolvedValue({
      status: 200,
      data: {
        paymentId: 'payment-fail',
        selectedPSP: 'stripe',
        reason: 'score',
        rankedPSPs: [{ pspName: 'stripe', score: 90, factors: {} }],
      },
    });
    fxPostMock.mockResolvedValue({
      status: 200,
      data: {
        quoteId: 'q-1',
        pair: 'USD-EUR',
        rate: 0.92,
        spread: 0.005,
        sourceAmount: 100,
        targetAmount: 92,
        expiresAt: new Date(Date.now() + 30_000),
      },
    });
    resolveAdapterMock.mockReturnValue({
      name: 'stripe',
      submitPayment: jest.fn().mockResolvedValue({
        success: false,
        pspTransactionId: 'stripe_tx_failed',
        status: 'REJECTED',
        message: 'declined',
      }),
    });
    executeFailureCompensationMock.mockResolvedValue({
      totalSteps: 1,
      completedSteps: 1,
      failedSteps: 0,
      results: [
        {
          step: 'notify-merchant',
          status: 'completed',
          durationMs: 5,
        },
      ],
    });
    publishMerchantWebhookMock.mockResolvedValue(undefined);

    const result = await paymentOrchestrator.createPayment(
      {
        merchantId: 'merchant-1',
        externalRef: 'order-fail',
        amount: 100,
        currency: 'USD',
        targetCurrency: 'EUR',
        beneficiary: {
          name: 'John Doe',
          country: 'DE',
        },
      },
      'req-2',
    );

    expect(result.status).toBe('FAILED');
    expect(result.failureReason).toBe('All configured PSP adapters failed');
    expect(executeFailureCompensationMock).toHaveBeenCalledTimes(1);
    expect(publishMerchantWebhookMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'payment.failed', paymentId: 'payment-fail' }),
      'req-2',
    );
    expect(releaseLockMock).toHaveBeenCalled();
  });

  it('initiates refund through resolved adapter and updates payment status', async () => {
    prismaMock.payment.findUnique.mockResolvedValue(paymentFixture({
      id: 'payment-refund',
      status: 'SETTLED',
      pspName: 'stripe',
      pspTransactionId: 'stripe_tx_1',
    }));
    resolveAdapterMock.mockReturnValue({
      name: 'stripe',
      initiateRefund: jest.fn().mockResolvedValue({
        success: true,
        refundId: 'refund-1',
        status: 'INITIATED',
      }),
    });
    prismaMock.payment.update.mockResolvedValue(paymentFixture({
      id: 'payment-refund',
      status: 'REFUND_INITIATED',
      pspName: 'stripe',
      pspTransactionId: 'stripe_tx_1',
    }));
    appendTransactionLogMock.mockResolvedValue(undefined);

    const result = await paymentOrchestrator.initiateRefund('payment-refund', 25, 'req-3');

    expect(result.status).toBe('REFUND_INITIATED');
    expect(prismaMock.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'payment-refund' },
      }),
    );
    expect(appendTransactionLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'payment-refund',
        event: 'refund.initiated',
      }),
    );
  });
});
