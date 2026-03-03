import { randomUUID } from 'node:crypto';
import { FXQuote, FXRate } from '@smartpay/shared';
import { SUPPORTED_PAIRS, normalizePair } from './supported-pairs';
import { deleteCachedQuote, getCachedRate, setCachedQuote, setCachedRate } from './rate-cache';
import { rateProviderService } from './rate-provider';
import { calculateSpread } from './spread-calculator';

export async function getLatestRate(pairInput: string): Promise<FXRate> {
  const pair = normalizePair(pairInput);
  if (!SUPPORTED_PAIRS.includes(pair as (typeof SUPPORTED_PAIRS)[number])) {
    throw new Error(`Currency pair ${pair} is not supported`);
  }

  const cached = await getCachedRate(pair);
  if (cached) {
    return cached;
  }

  const [fresh] = await rateProviderService.fetchRates([pair]);
  await setCachedRate(fresh);
  return fresh;
}

export async function refreshAllRates(): Promise<FXRate[]> {
  const rates = await rateProviderService.fetchRates([...SUPPORTED_PAIRS]);
  await Promise.all(rates.map((rate) => setCachedRate(rate)));
  return rates;
}

export async function createQuote(input: {
  pair: string;
  sourceAmount: number;
  merchantId: string;
  merchantSpreadBps?: number;
}): Promise<FXQuote> {
  void input.merchantId;
  const rate = await getLatestRate(input.pair);
  const spread = calculateSpread(rate.mid, input.sourceAmount, input.merchantSpreadBps ?? 50);

  const quote: FXQuote = {
    quoteId: randomUUID(),
    pair: normalizePair(input.pair),
    rate: Number(spread.appliedRate.toFixed(8)),
    spread: spread.spreadRate,
    sourceAmount: input.sourceAmount,
    targetAmount: spread.targetAmount,
    expiresAt: new Date(Date.now() + 30_000),
  };

  await setCachedQuote(quote);
  return quote;
}

export function listSupportedPairs(): readonly string[] {
  return SUPPORTED_PAIRS;
}

export async function releaseQuote(quoteId: string): Promise<{ quoteId: string; released: boolean }> {
  const deleted = await deleteCachedQuote(quoteId);
  return {
    quoteId,
    released: deleted > 0,
  };
}
