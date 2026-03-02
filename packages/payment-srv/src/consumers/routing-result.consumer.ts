import { createLogger } from '@smartpay/shared';

const logger = createLogger({ service: 'payment-srv', component: 'routing-result-consumer' });

export async function startRoutingResultConsumer(): Promise<void> {
  logger.info('routing-result consumer is not enabled yet');
  // TODO: consume routing.decision once async route decision flow is enabled.
}
