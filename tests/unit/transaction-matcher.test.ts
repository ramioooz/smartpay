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

  it('treats sub-cent amount differences as matched', () => {
    const result = matcher.matchByPsp(
      'stripe',
      [
        {
          paymentId: 'p-3',
          pspTransactionId: 'tx-3',
          settledAmount: 100,
          settledCurrency: 'USD',
          status: 'SETTLED',
        },
      ],
      [
        {
          paymentId: 'p-3',
          pspName: 'stripe',
          pspTransactionId: 'tx-3',
          amount: 100.009,
          currency: 'USD',
          status: 'SETTLED',
          settledAt: new Date(),
        },
      ],
    );

    expect(result.matched).toBe(1);
    expect(result.discrepancies).toHaveLength(0);
  });

  it('flags missing records on PSP', () => {
    const result = matcher.matchByPsp(
      'wise',
      [
        {
          paymentId: 'p-4',
          pspTransactionId: 'tx-4',
          settledAmount: 50,
          settledCurrency: 'EUR',
          status: 'SETTLED',
        },
      ],
      [],
    );

    expect(result.matched).toBe(0);
    expect(result.discrepancies[0]?.discrepancyType).toBe(DiscrepancyType.MISSING_ON_PSP);
  });

  it('flags missing internal records when PSP has extra settlements', () => {
    const result = matcher.matchByPsp('checkout', [], [
      {
        pspName: 'checkout',
        pspTransactionId: 'tx-ext-1',
        amount: 75,
        currency: 'GBP',
        status: 'SETTLED',
        settledAt: new Date(),
      },
    ]);

    expect(result.matched).toBe(0);
    expect(result.discrepancies[0]?.discrepancyType).toBe(DiscrepancyType.MISSING_INTERNAL);
  });

  it('flags status mismatch when amount and currency match', () => {
    const result = matcher.matchByPsp(
      'stripe',
      [
        {
          paymentId: 'p-5',
          pspTransactionId: 'tx-5',
          settledAmount: 125,
          settledCurrency: 'USD',
          status: 'SETTLED',
        },
      ],
      [
        {
          paymentId: 'p-5',
          pspName: 'stripe',
          pspTransactionId: 'tx-5',
          amount: 125,
          currency: 'USD',
          status: 'REFUNDED',
          settledAt: new Date(),
        },
      ],
    );

    expect(result.matched).toBe(0);
    expect(result.discrepancies[0]?.discrepancyType).toBe(DiscrepancyType.STATUS_MISMATCH);
  });

  it('flags currency mismatch when amount and status match', () => {
    const result = matcher.matchByPsp(
      'wise',
      [
        {
          paymentId: 'p-6',
          pspTransactionId: 'tx-6',
          settledAmount: 250,
          settledCurrency: 'USD',
          status: 'SETTLED',
        },
      ],
      [
        {
          paymentId: 'p-6',
          pspName: 'wise',
          pspTransactionId: 'tx-6',
          amount: 250,
          currency: 'EUR',
          status: 'SETTLED',
          settledAt: new Date(),
        },
      ],
    );

    expect(result.matched).toBe(0);
    expect(result.discrepancies[0]?.discrepancyType).toBe(DiscrepancyType.CURRENCY_MISMATCH);
  });

  it('matches records despite tx id casing or surrounding whitespace', () => {
    const result = matcher.matchByPsp(
      'stripe',
      [
        {
          paymentId: 'p-7',
          pspTransactionId: ' TX-NORM-1 ',
          settledAmount: 99,
          settledCurrency: 'USD',
          status: 'SETTLED',
        },
      ],
      [
        {
          paymentId: 'p-7',
          pspName: 'stripe',
          pspTransactionId: 'tx-norm-1',
          amount: 99,
          currency: 'USD',
          status: 'SETTLED',
          settledAt: new Date(),
        },
      ],
    );

    expect(result.matched).toBe(1);
    expect(result.discrepancies).toHaveLength(0);
  });
});
