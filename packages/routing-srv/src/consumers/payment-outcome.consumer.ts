import { KafkaConsumer, TOPICS, createKafkaClient, createLogger } from '@smartpay/shared';
import { config } from '../config';
import { pspHealthTracker } from '../services/psp-health-tracker';
import { getRedisClient } from '../services/redis';

const logger = createLogger({ service: 'routing-srv', component: 'payment-outcome-consumer' });

const DEDUPE_TTL_SECONDS = 24 * 60 * 60;
const DEFAULT_LATENCY_MS = 150;

type PaymentSettledEvent = {
  paymentId: string;
  pspName: string;
  latencyMs?: number;
};

type PaymentFailedEvent = {
  paymentId: string;
  pspName: string;
  reason?: string;
  latencyMs?: number;
};

let paymentOutcomeConsumers: KafkaConsumer[] = [];

function parseCorrelationId(
  headers: Record<string, unknown> | undefined,
  paymentId: string,
): string {
  if (!headers) {
    return `${paymentId}:${Date.now()}`;
  }

  const getHeaderValue = (key: string): string | undefined => {
    const value = headers[key] as unknown;
    if (Array.isArray(value)) {
      return value[0]?.toString();
    }

    if (value === undefined || value === null) {
      return undefined;
    }

    return String(value);
  };

  const correlationId =
    getHeaderValue('correlation-id') ??
    getHeaderValue('x-request-id');

  return correlationId || `${paymentId}:${Date.now()}`;
}

function isValidOutcomeEvent(payload: unknown): payload is PaymentSettledEvent | PaymentFailedEvent {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const event = payload as { paymentId?: unknown; pspName?: unknown };
  return typeof event.paymentId === 'string' && typeof event.pspName === 'string';
}

async function shouldProcessEvent(topic: string, paymentId: string): Promise<boolean> {
  const redis = getRedisClient();
  const dedupeKey = `consumed:${topic}:${paymentId}`;
  const result = await redis.set(dedupeKey, '1', 'EX', DEDUPE_TTL_SECONDS, 'NX');
  return result === 'OK';
}

async function startSingleConsumer(
  topic: string,
  groupId: string,
  success: boolean,
): Promise<KafkaConsumer> {
  const kafka = createKafkaClient(groupId, config.kafkaBrokers);
  const consumer = new KafkaConsumer(kafka.consumer({ groupId }), kafka.producer());
  await consumer.connect();
  await consumer.subscribeAndRun<PaymentSettledEvent | PaymentFailedEvent>(
    {
      topic,
      maxFailures: 3,
    },
    async (event, message) => {
      if (!isValidOutcomeEvent(event)) {
        logger.warn({ topic, event }, 'Skipping malformed payment outcome event');
        return;
      }

      const isNew = await shouldProcessEvent(topic, event.paymentId);
      if (!isNew) {
        logger.debug({ topic, paymentId: event.paymentId }, 'Skipping duplicate payment outcome event');
        return;
      }

      const correlationId = parseCorrelationId(
        message.headers as Record<string, unknown> | undefined,
        event.paymentId,
      );
      const latencyMs =
        typeof event.latencyMs === 'number' && event.latencyMs > 0
          ? event.latencyMs
          : DEFAULT_LATENCY_MS;
      const failureReason =
        success || !('reason' in event) || typeof event.reason !== 'string'
          ? undefined
          : event.reason;

      await pspHealthTracker.recordOutcome({
        pspName: event.pspName,
        success,
        latencyMs,
        failureReason,
      });

      logger.info(
        {
          topic,
          paymentId: event.paymentId,
          pspName: event.pspName,
          success,
          correlationId,
        },
        'Processed payment outcome event',
      );
    },
  );

  return consumer;
}

export async function startPaymentOutcomeConsumer(): Promise<void> {
  if (paymentOutcomeConsumers.length > 0) {
    return;
  }

  const startedConsumers: KafkaConsumer[] = [];

  try {
    const settledConsumer = await startSingleConsumer(
      TOPICS.PAYMENT_SETTLED,
      'routing-srv-payment-settled',
      true,
    );
    startedConsumers.push(settledConsumer);

    const failedConsumer = await startSingleConsumer(
      TOPICS.PAYMENT_FAILED,
      'routing-srv-payment-failed',
      false,
    );
    startedConsumers.push(failedConsumer);

    paymentOutcomeConsumers = startedConsumers;
    logger.info(
      { topics: [TOPICS.PAYMENT_SETTLED, TOPICS.PAYMENT_FAILED] },
      'Payment outcome consumers started',
    );
  } catch (error) {
    await Promise.all(startedConsumers.map((consumer) => consumer.disconnect()));
    paymentOutcomeConsumers = [];
    throw error;
  }
}

export async function stopPaymentOutcomeConsumer(): Promise<void> {
  if (paymentOutcomeConsumers.length === 0) {
    return;
  }

  await Promise.all(paymentOutcomeConsumers.map((consumer) => consumer.disconnect()));
  paymentOutcomeConsumers = [];
}
