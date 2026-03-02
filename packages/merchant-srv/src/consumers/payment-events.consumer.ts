import { KafkaConsumer, TOPICS, createKafkaClient, createLogger } from '@smartpay/shared';
import { config } from '../config';
import { webhookService } from '../services/webhook.service';

const logger = createLogger({ service: 'merchant-srv', component: 'payment-events-consumer' });

type MerchantWebhookEvent = {
  type: 'payment.settled' | 'payment.failed' | 'payment.refunded';
  merchantId: string;
  paymentId: string;
  [key: string]: unknown;
};

let paymentEventsConsumer: KafkaConsumer | null = null;

export async function startPaymentEventsConsumer(): Promise<void> {
  if (paymentEventsConsumer) {
    return;
  }

  const kafka = createKafkaClient('merchant-srv-payment-events', config.kafkaBrokers);
  paymentEventsConsumer = new KafkaConsumer(
    kafka.consumer({ groupId: 'merchant-srv-payment-events' }),
    kafka.producer(),
  );

  await paymentEventsConsumer.connect();
  await paymentEventsConsumer.subscribeAndRun<MerchantWebhookEvent>(
    {
      topic: TOPICS.MERCHANT_WEBHOOK,
      maxFailures: 3,
    },
    async (event, message) => {
      if (!event?.merchantId || !event?.paymentId || !event?.type) {
        logger.warn({ event }, 'Skipping malformed merchant webhook event');
        return;
      }

      const correlationId =
        message.headers?.['correlation-id']?.toString() ??
        message.headers?.['x-request-id']?.toString() ??
        `${event.paymentId}:${Date.now()}`;

      await webhookService.dispatchWebhook(event, correlationId);
    },
  );

  logger.info({ topic: TOPICS.MERCHANT_WEBHOOK }, 'Merchant payment events consumer started');
}

export async function stopPaymentEventsConsumer(): Promise<void> {
  if (!paymentEventsConsumer) {
    return;
  }

  await paymentEventsConsumer.disconnect();
  paymentEventsConsumer = null;
}
