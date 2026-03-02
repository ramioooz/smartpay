import { DiscrepancyType } from '../../packages/shared/src/types/reconciliation.types';
import { TransactionMatcher } from '../../packages/reconciliation-srv/src/services/transaction-matcher';

describe('transaction-matcher', () => {
  const matcher = new TransactionMatcher() as unknown as {
    matchByPsp: (
      pspName: string,
      internal: Array<{
        paymentId: string;
        pspTransactionId: string;
        settledAmount: number;
        settledCurrency: string;
        status: 'SETTLED' | 'REFUNDED';
      }>,
      psp: Array<{
        paymentId?: string;
        pspName: string;
        pspTransactionId: string;
        amount: number;
        currency: string;
        status: 'SETTLED' | 'FAILED' | 'REFUNDED';
        settledAt: Date;
      }>,
    ) => { matched: number; discrepancies: Array<{ discrepancyType?: DiscrepancyType }> };
  };

  it('counts perfect matches', () => {
    const result = matcher.matchByPsp(
      'stripe',
      [
        {
          paymentId: 'p-1',
          pspTransactionId: 'tx-1',
          settledAmount: 100,
          settledCurrency: 'USD',
          status: 'SETTLED',
        },
      ],
      [
        {
          paymentId: 'p-1',
          pspName: 'stripe',
          pspTransactionId: 'tx-1',
          amount: 100,
          currency: 'USD',
          status: 'SETTLED',
          settledAt: new Date(),
        },
      ],
    );

    expect(result.matched).toBe(1);
    expect(result.discrepancies).toHaveLength(0);
  });

  it('flags amount mismatch discrepancies', () => {
    const result = matcher.matchByPsp(
      'stripe',
      [
        {
          paymentId: 'p-2',
          pspTransactionId: 'tx-2',
          settledAmount: 100,
          settledCurrency: 'USD',
          status: 'SETTLED',
        },
      ],
      [
        {
          paymentId: 'p-2',
          pspName: 'stripe',
          pspTransactionId: 'tx-2',
          amount: 100.05,
          currency: 'USD',
          status: 'SETTLED',
          settledAt: new Date(),
        },
      ],
    );

    expect(result.matched).toBe(0);
    expect(result.discrepancies[0]?.discrepancyType).toBe(DiscrepancyType.AMOUNT_MISMATCH);
  });
});
