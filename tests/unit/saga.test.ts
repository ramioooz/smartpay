const appendTransactionLogMock = jest.fn();

jest.mock('../../packages/payment-srv/src/services/transaction-log', () => ({
  appendTransactionLog: appendTransactionLogMock,
}));

import { executeFailureCompensation } from '../../packages/payment-srv/src/services/saga';

describe('saga compensation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appendTransactionLogMock.mockResolvedValue(undefined);
  });

  it('executes compensation steps in reverse order and returns completion summary', async () => {
    const executionOrder: string[] = [];
    const summary = await executeFailureCompensation('payment-1', 'corr-1', [
      {
        name: 'first',
        run: async () => {
          executionOrder.push('first');
        },
      },
      {
        name: 'second',
        run: async () => {
          executionOrder.push('second');
        },
      },
      {
        name: 'third',
        run: async () => {
          executionOrder.push('third');
        },
      },
    ]);

    expect(executionOrder).toEqual(['third', 'second', 'first']);
    expect(summary.totalSteps).toBe(3);
    expect(summary.completedSteps).toBe(3);
    expect(summary.failedSteps).toBe(0);
    expect(appendTransactionLogMock).toHaveBeenCalledTimes(3);
  });

  it('continues after failed steps and includes failure details in summary', async () => {
    const summary = await executeFailureCompensation('payment-2', 'corr-2', [
      { name: 'cleanup-a', run: async () => undefined },
      {
        name: 'cleanup-b',
        run: async () => {
          throw new Error('cleanup-b failed');
        },
      },
    ]);

    expect(summary.totalSteps).toBe(2);
    expect(summary.completedSteps).toBe(1);
    expect(summary.failedSteps).toBe(1);
    expect(summary.results.find((result) => result.step === 'cleanup-b')?.error).toBe(
      'cleanup-b failed',
    );
    expect(appendTransactionLogMock).toHaveBeenCalledTimes(2);
  });
});
