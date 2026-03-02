import {
  createLogger,
  PaymentSettledEvent,
  TOPICS,
} from '@smartpay/shared';
import { settledPaymentCollection } from '../models/settled-payment.model';
import { getKafkaConsumer } from '../services/kafka';
import { getRedisClient } from '../services/redis';

const logger = createLogger({ service: 'reconciliation-srv', component: 'payment-settled-consumer' });

function isPaymentSettledEvent(payload: unknown): payload is PaymentSettledEvent {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate.paymentId === 'string' &&
    typeof candidate.pspName === 'string' &&
    typeof candidate.pspTransactionId === 'string' &&
    typeof candidate.settledAmount === 'number' &&
    typeof candidate.settledCurrency === 'string'
  );
}

export async function startPaymentSettledConsumer(): Promise<void> {
  const consumer = await getKafkaConsumer('reconciliation-srv-payment-settled');
  const redis = getRedisClient();

  await consumer.subscribeAndRun<unknown>(
    {
      topic: TOPICS.PAYMENT_SETTLED,
      dlqTopic: `${TOPICS.PAYMENT_SETTLED}.dlq`,
      maxFailures: 3,
    },
    async (payload) => {
      if (!isPaymentSettledEvent(payload)) {
        throw new Error('payment.settled payload is missing required fields');
      }

      const dedupeKey = `consumed:${TOPICS.PAYMENT_SETTLED}:${payload.paymentId}`;
      const isNew = await redis.set(dedupeKey, '1', 'EX', 86_400, 'NX');
      if (!isNew) {
        return;
      }

      const collection = await settledPaymentCollection();
      await collection.updateOne(
        { pspTransactionId: payload.pspTransactionId },
        {
          $set: {
            paymentId: payload.paymentId,
            pspName: payload.pspName,
            pspTransactionId: payload.pspTransactionId,
            settledAmount: payload.settledAmount,
            settledCurrency: payload.settledCurrency,
            status: 'SETTLED',
            settledAt: new Date(payload.timestamp),
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
    },
  );

  logger.info('payment.settled consumer started');
}
