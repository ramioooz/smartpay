import { RoutingDecision, RoutingRequest, PSPScore, createLogger } from '@smartpay/shared';
import { ruleManager } from './rule-manager';
import { pspHealthTracker } from './psp-health-tracker';
import { getRedisClient } from './redis';

const logger = createLogger({ service: 'routing-srv', component: 'routing-engine' });

type PspProfile = {
  name: string;
  supportedCurrencies: string[];
  supportedCountries: string[];
  baseCostScore: number;
};

const PSP_PROFILES: PspProfile[] = [
  {
    name: 'stripe',
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
    supportedCountries: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'NL'],
    baseCostScore: 78,
  },
  {
    name: 'wise',
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'AED', 'INR', 'PHP', 'BRL'],
    supportedCountries: ['US', 'GB', 'AE', 'IN', 'PH', 'BR', 'DE', 'FR', 'CA'],
    baseCostScore: 85,
  },
  {
    name: 'checkout',
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'KWD'],
    supportedCountries: ['AE', 'SA', 'KW', 'GB', 'US', 'FR'],
    baseCostScore: 72,
  },
  {
    name: 'crypto-rail',
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'AED', 'INR', 'PHP', 'BRL', 'SAR', 'KWD'],
    supportedCountries: ['US', 'GB', 'AE', 'IN', 'PH', 'BR', 'SA', 'KW', 'DE', 'FR', 'NL'],
    baseCostScore: 92,
  },
];

const WEIGHTS = {
  cost: 0.35,
  latency: 0.25,
  reliability: 0.4,
};

function computeCostScore(profile: PspProfile, amount: number): number {
  if (profile.name === 'crypto-rail' && amount > 10_000) return 96;
  if (profile.name === 'stripe' && amount <= 1_000) return 90;
  if (profile.name === 'wise' && amount > 5_000) return 91;
  return profile.baseCostScore;
}

export class RoutingEngine {
  async route(request: RoutingRequest): Promise<RoutingDecision> {
    const rules = await ruleManager.listActiveRules();
    const matches = ruleManager.evaluateRules(request, rules);

    if (matches.force) {
      return {
        paymentId: request.paymentId,
        selectedPSP: matches.force,
        reason: `Routing FORCE rule selected ${matches.force}`,
        rankedPSPs: [
          {
            pspName: matches.force,
            score: 100,
            factors: {
              costScore: 100,
              latencyScore: 100,
              successRateScore: 100,
              currencySupport: true,
              countrySupport: true,
            },
          },
        ],
      };
    }

    const scores: PSPScore[] = [];

    for (const profile of PSP_PROFILES) {
      if (matches.excludes.has(profile.name)) {
        continue;
      }

      if (!profile.supportedCurrencies.includes(request.currency)) {
        continue;
      }

      if (!profile.supportedCountries.includes(request.beneficiaryCountry)) {
        continue;
      }

      const circuitOpen = await this.isCircuitOpen(profile.name);
      if (circuitOpen) {
        continue;
      }

      const health = await pspHealthTracker.getLatest(profile.name);
      const successRateScore = Math.round((health?.successRate ?? 0.95) * 100);
      const latencyScore = Math.max(10, 100 - Math.round((health?.averageLatencyMs ?? 120) / 10));
      const costScore = computeCostScore(profile, request.amount);
      const boost = matches.boosts.get(profile.name) ?? 0;

      const score =
        costScore * WEIGHTS.cost +
        latencyScore * WEIGHTS.latency +
        successRateScore * WEIGHTS.reliability +
        boost;

      scores.push({
        pspName: profile.name,
        score: Number(score.toFixed(2)),
        factors: {
          costScore,
          latencyScore,
          successRateScore,
          currencySupport: true,
          countrySupport: true,
        },
      });
    }

    scores.sort((a, b) => b.score - a.score);

    if (scores.length === 0) {
      logger.warn({ request }, 'No eligible PSP candidates, defaulting to stripe');
      const fallback: PSPScore = {
        pspName: 'stripe',
        score: 1,
        factors: {
          costScore: 1,
          latencyScore: 1,
          successRateScore: 1,
          currencySupport: false,
          countrySupport: false,
        },
      };

      return {
        paymentId: request.paymentId,
        selectedPSP: 'stripe',
        reason: 'Fallback selection due to zero eligible candidates',
        rankedPSPs: [fallback],
      };
    }

    return {
      paymentId: request.paymentId,
      selectedPSP: scores[0].pspName,
      reason: `Selected ${scores[0].pspName} based on weighted scoring`,
      rankedPSPs: scores.slice(0, 3),
    };
  }

  private async isCircuitOpen(pspName: string): Promise<boolean> {
    const state = await getRedisClient().get(`payment:circuit:${pspName}:state`);
    return state === 'OPEN';
  }
}

export const routingEngine = new RoutingEngine();
