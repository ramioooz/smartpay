import { createLogger } from '@smartpay/shared';
import { appendTransactionLog } from './transaction-log';

const logger = createLogger({ service: 'payment-srv', component: 'saga' });

type CompensationStep = {
  name: string;
  run: () => Promise<void>;
};

export async function executeFailureCompensation(
  paymentId: string,
  correlationId: string,
  steps: CompensationStep[],
): Promise<void> {
  for (const step of [...steps].reverse()) {
    try {
      await step.run();
      await appendTransactionLog({
        paymentId,
        event: 'saga.compensate',
        correlationId,
        response: { step: step.name, status: 'completed' },
      });
    } catch (error) {
      logger.error({ error, paymentId, step: step.name }, 'Compensation step failed');
      await appendTransactionLog({
        paymentId,
        event: 'saga.compensate',
        correlationId,
        error: error instanceof Error ? error.message : 'Compensation step failed',
        response: { step: step.name, status: 'failed' },
      });
      // TODO: add alerting for compensation failures once incident pipeline is wired.
    }
  }
}
