import { createLogger } from '@smartpay/shared';
import { appendTransactionLog } from './transaction-log';

const logger = createLogger({ service: 'payment-srv', component: 'saga' });

export type CompensationStep = {
  name: string;
  run: () => Promise<void>;
};

export type CompensationStepResult = {
  step: string;
  status: 'completed' | 'failed';
  durationMs: number;
  error?: string;
};

export type CompensationSummary = {
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  results: CompensationStepResult[];
};

export async function executeFailureCompensation(
  paymentId: string,
  correlationId: string,
  steps: CompensationStep[],
): Promise<CompensationSummary> {
  const results: CompensationStepResult[] = [];

  for (const step of [...steps].reverse()) {
    const startedAt = Date.now();
    try {
      await step.run();
      const durationMs = Date.now() - startedAt;
      const result: CompensationStepResult = {
        step: step.name,
        status: 'completed',
        durationMs,
      };
      results.push(result);
      await appendTransactionLog({
        paymentId,
        event: 'saga.compensate',
        correlationId,
        response: result,
        durationMs,
      });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const errorMessage = error instanceof Error ? error.message : 'Compensation step failed';
      const result: CompensationStepResult = {
        step: step.name,
        status: 'failed',
        durationMs,
        error: errorMessage,
      };
      results.push(result);
      logger.error({ error, paymentId, step: step.name, correlationId }, 'Compensation step failed');
      await appendTransactionLog({
        paymentId,
        event: 'saga.compensate',
        correlationId,
        error: errorMessage,
        response: result,
        durationMs,
      });
      // TODO: add alerting for compensation failures once incident pipeline is wired.
    }
  }

  const summary: CompensationSummary = {
    totalSteps: results.length,
    completedSteps: results.filter((result) => result.status === 'completed').length,
    failedSteps: results.filter((result) => result.status === 'failed').length,
    results,
  };

  return summary;
}
