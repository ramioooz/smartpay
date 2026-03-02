import { createKafkaClient, KafkaProducer, TOPICS } from '@smartpay/shared';
import { config } from '../config';

let producer: KafkaProducer | null = null;

export async function initWebhookDispatcher(): Promise<void> {
  if (producer) {
    return;
  }

  const kafka = createKafkaClient('payment-srv-webhook-dispatcher', config.kafkaBrokers);
  producer = new KafkaProducer(kafka.producer());
  await producer.connect();
}

export async function publishMerchantWebhook(
  event: Record<string, unknown>,
  correlationId: string,
): Promise<void> {
  if (!producer) {
    return;
  }

  await producer.publish(TOPICS.MERCHANT_WEBHOOK, event, { correlationId });
}

export async function closeWebhookDispatcher(): Promise<void> {
  if (!producer) {
    return;
  }

  await producer.disconnect();
  producer = null;
}
