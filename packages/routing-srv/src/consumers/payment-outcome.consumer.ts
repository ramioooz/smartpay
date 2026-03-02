import { createLogger } from '@smartpay/shared';

const logger = createLogger({ service: 'routing-srv', component: 'payment-outcome-consumer' });

export async function startPaymentOutcomeConsumer(): Promise<void> {
  logger.info('payment outcome consumer is not enabled yet');
  // TODO: consume payment.settled/payment.failed events and update health tracker in near-real-time.
}
