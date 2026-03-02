import { createHmac } from 'node:crypto';
import { config } from '../config';

export class WebhookService {
  signPayload(payload: string, merchantSecret: string): string {
    return createHmac('sha256', `${merchantSecret}:${config.WEBHOOK_HMAC_SALT}`).update(payload).digest('hex');
  }

  async dispatchWebhook(): Promise<void> {
    // TODO: add Kafka consumer-backed webhook dispatch with retries in a follow-up PR.
  }
}

export const webhookService = new WebhookService();
