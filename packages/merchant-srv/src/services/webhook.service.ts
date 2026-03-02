import { createHmac } from 'node:crypto';
import { createLogger } from '@smartpay/shared';
import { config } from '../config';
import { getMongoClient } from './mongo';

const logger = createLogger({ service: 'merchant-srv', component: 'webhook-service' });

type MerchantWebhookEvent = {
  type: 'payment.settled' | 'payment.failed' | 'payment.refunded';
  merchantId: string;
  paymentId: string;
  timestamp?: string;
  [key: string]: unknown;
};

type WebhookAttemptLog = {
  merchantId: string;
  paymentId: string;
  eventType: MerchantWebhookEvent['type'];
  webhookUrl: string;
  delivered: boolean;
  statusCode?: number;
  attempt: number;
  error?: string;
  correlationId: string;
  createdAt: Date;
};

export class WebhookService {
  signPayload(payload: string, merchantSecret: string): string {
    return createHmac('sha256', `${merchantSecret}:${config.WEBHOOK_HMAC_SALT}`).update(payload).digest('hex');
  }

  private async readWebhookUrl(
    merchantId: string,
    eventType: MerchantWebhookEvent['type'],
  ): Promise<string | undefined> {
    const mongo = await getMongoClient();
    const configDoc = await mongo
      .db('smartpay')
      .collection<{ webhooks?: Partial<Record<MerchantWebhookEvent['type'], string>> }>('merchant_configs')
      .findOne({ merchantId });

    return configDoc?.webhooks?.[eventType];
  }

  private async logAttempt(entry: WebhookAttemptLog): Promise<void> {
    const mongo = await getMongoClient();
    await mongo.db('smartpay').collection<WebhookAttemptLog>('webhook_deliveries').insertOne(entry);
  }

  async dispatchWebhook(event: MerchantWebhookEvent, correlationId: string): Promise<void> {
    const webhookUrl = await this.readWebhookUrl(event.merchantId, event.type);
    if (!webhookUrl) {
      logger.info(
        { merchantId: event.merchantId, eventType: event.type },
        'Skipping webhook dispatch because no webhook URL is registered',
      );
      return;
    }

    const payload = JSON.stringify(event);
    // TODO: replace merchantId fallback with a dedicated merchant webhook secret.
    const signature = this.signPayload(payload, event.merchantId);
    const retryDelaysMs = [0, 1_000, 5_000];
    let delivered = false;

    for (let attemptIndex = 0; attemptIndex < retryDelaysMs.length; attemptIndex += 1) {
      const attempt = attemptIndex + 1;
      const delayMs = retryDelaysMs[attemptIndex];

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-webhook-signature': signature,
            'x-correlation-id': correlationId,
          },
          body: payload,
        });

        if (!response.ok) {
          throw new Error(`Webhook endpoint ${webhookUrl} returned HTTP ${response.status}`);
        }

        await this.logAttempt({
          merchantId: event.merchantId,
          paymentId: event.paymentId,
          eventType: event.type,
          webhookUrl,
          delivered: true,
          statusCode: response.status,
          attempt,
          correlationId,
          createdAt: new Date(),
        });
        delivered = true;
        break;
      } catch (error) {
        await this.logAttempt({
          merchantId: event.merchantId,
          paymentId: event.paymentId,
          eventType: event.type,
          webhookUrl,
          delivered: false,
          attempt,
          error: error instanceof Error ? error.message : String(error),
          correlationId,
          createdAt: new Date(),
        });
      }
    }

    if (!delivered) {
      logger.warn(
        {
          merchantId: event.merchantId,
          paymentId: event.paymentId,
          eventType: event.type,
          webhookUrl,
        },
        'Webhook delivery failed after all retry attempts',
      );
    }
  }
}

export const webhookService = new WebhookService();
