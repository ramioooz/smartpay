import { RoutingRequest } from '../../packages/shared/src/types/routing.types';

jest.mock('../../packages/routing-srv/src/services/rule-manager', () => ({
  ruleManager: {
    listActiveRules: jest.fn(),
    evaluateRules: jest.fn(),
  },
}));

jest.mock('../../packages/routing-srv/src/services/psp-health-tracker', () => ({
  pspHealthTracker: {
    getLatest: jest.fn(),
  },
}));

jest.mock('../../packages/routing-srv/src/services/redis', () => ({
  getRedisClient: jest.fn(),
}));

import { routingEngine } from '../../packages/routing-srv/src/services/routing-engine';
import { ruleManager } from '../../packages/routing-srv/src/services/rule-manager';
import { pspHealthTracker } from '../../packages/routing-srv/src/services/psp-health-tracker';
import { getRedisClient } from '../../packages/routing-srv/src/services/redis';

type RuleEvaluation = {
  excludes: Set<string>;
  boosts: Map<string, number>;
  force?: string;
};

const baseRequest: RoutingRequest = {
  paymentId: 'payment-1',
  merchantId: 'merchant-1',
  amount: 1500,
  currency: 'USD',
  targetCurrency: 'AED',
  beneficiaryCountry: 'AE',
};

describe('routing-engine', () => {
  const mockedRuleManager = ruleManager as jest.Mocked<typeof ruleManager>;
  const mockedHealthTracker = pspHealthTracker as jest.Mocked<typeof pspHealthTracker>;
  const mockedGetRedisClient = getRedisClient as jest.MockedFunction<typeof getRedisClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockedRuleManager.listActiveRules.mockResolvedValue([]);
    mockedRuleManager.evaluateRules.mockReturnValue({
      excludes: new Set<string>(),
      boosts: new Map<string, number>(),
    } as RuleEvaluation);

    mockedHealthTracker.getLatest.mockResolvedValue({
      pspName: 'default',
      successRate: 0.95,
      averageLatencyMs: 120,
      total: 100,
    });

    mockedGetRedisClient.mockReturnValue({
      get: jest.fn().mockResolvedValue(null),
    } as never);
  });

  it('scores PSPs and returns the highest ranked selection', async () => {
    mockedHealthTracker.getLatest.mockImplementation(async (pspName: string) => {
      if (pspName === 'crypto-rail') {
        return {
          pspName,
          successRate: 0.99,
          averageLatencyMs: 80,
          total: 300,
        };
      }

      return {
        pspName,
        successRate: 0.9,
        averageLatencyMs: 180,
        total: 200,
      };
    });

    const result = await routingEngine.route({
      ...baseRequest,
      amount: 20_000,
    });

    expect(result.selectedPSP).toBe('crypto-rail');
    expect(result.rankedPSPs.length).toBeGreaterThan(0);
    expect(result.rankedPSPs[0].pspName).toBe('crypto-rail');
  });

  it('applies FORCE rule immediately without evaluating full scoring', async () => {
    mockedRuleManager.evaluateRules.mockReturnValue({
      excludes: new Set<string>(),
      boosts: new Map<string, number>(),
      force: 'wise',
    } as RuleEvaluation);

    const result = await routingEngine.route(baseRequest);

    expect(result.selectedPSP).toBe('wise');
    expect(result.rankedPSPs).toHaveLength(1);
    expect(result.rankedPSPs[0].score).toBe(100);
    expect(mockedHealthTracker.getLatest).not.toHaveBeenCalled();
  });

  it('falls back to stripe when no candidates are eligible', async () => {
    mockedRuleManager.evaluateRules.mockReturnValue({
      excludes: new Set<string>(['stripe', 'wise', 'checkout', 'crypto-rail']),
      boosts: new Map<string, number>(),
    } as RuleEvaluation);

    const result = await routingEngine.route(baseRequest);

    expect(result.selectedPSP).toBe('stripe');
    expect(result.reason).toContain('Fallback selection');
    expect(result.rankedPSPs[0].factors.currencySupport).toBe(false);
  });
});
