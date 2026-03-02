const resolveProvider = jest.fn();
const initialize = jest.fn();
const getAllProviders = jest.fn();

const distinct = jest.fn();
const toArray = jest.fn();
const find = jest.fn(() => ({ toArray }));
const collectionFactory = jest.fn(async () => ({
  find,
  distinct,
}));

jest.mock('../../packages/reconciliation-srv/src/providers/settlement-provider-registry', () => ({
  settlementProviderRegistry: {
    resolveProvider,
    initialize,
    getAllProviders,
  },
}));

jest.mock('../../packages/reconciliation-srv/src/models/settled-payment.model', () => ({
  settledPaymentCollection: collectionFactory,
}));

import { settlementFetcher } from '../../packages/reconciliation-srv/src/services/settlement-fetcher';

describe('settlement-fetcher', () => {
  beforeEach(() => {
    resolveProvider.mockReset();
    initialize.mockReset();
    getAllProviders.mockReset();
    collectionFactory.mockClear();
    find.mockClear();
    toArray.mockReset();
    distinct.mockReset();
  });

  it('returns empty set for unregistered PSP providers', async () => {
    resolveProvider.mockReturnValue(undefined);

    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-01T01:00:00.000Z');
    const result = await settlementFetcher.fetchSettlementsByPsp(['stripe'], from, to);

    expect(result.get('stripe')).toEqual([]);
  });

  it('returns empty set when provider is unavailable', async () => {
    const provider = {
      pspName: 'wise',
      isAvailable: jest.fn().mockResolvedValue(false),
      fetchSettlements: jest.fn(),
    };
    resolveProvider.mockReturnValue(provider);

    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-01T01:00:00.000Z');
    const result = await settlementFetcher.fetchSettlementsByPsp(['wise'], from, to);

    expect(provider.fetchSettlements).not.toHaveBeenCalled();
    expect(result.get('wise')).toEqual([]);
  });

  it('fetches and returns settlements for available providers', async () => {
    const records = [
      {
        paymentId: 'p-1',
        pspName: 'checkout',
        pspTransactionId: 'tx-1',
        amount: 10,
        currency: 'USD',
        status: 'SETTLED',
        settledAt: new Date('2026-01-01T00:30:00.000Z'),
      },
    ];
    const provider = {
      pspName: 'checkout',
      isAvailable: jest.fn().mockResolvedValue(true),
      fetchSettlements: jest.fn().mockResolvedValue(records),
    };
    resolveProvider.mockReturnValue(provider);

    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-01T01:00:00.000Z');
    const result = await settlementFetcher.fetchSettlementsByPsp(['checkout'], from, to);

    expect(provider.fetchSettlements).toHaveBeenCalledWith(from, to);
    expect(result.get('checkout')).toEqual(records);
  });

  it('filters invalid PSP names from distinct query results', async () => {
    distinct.mockResolvedValue(['stripe', '', null, 'wise', 42, 'checkout']);
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-01T01:00:00.000Z');

    const pspNames = await settlementFetcher.listActivePspNames(from, to);

    expect(pspNames).toEqual(['stripe', 'wise', 'checkout']);
  });
});
