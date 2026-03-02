import { FXQuote, FXRate } from '@smartpay/shared';
import { config } from '../config';
import { getRedisClient } from './redis';

function rateKey(pair: string): string {
  return `rates:${pair}`;
}

function quoteKey(quoteId: string): string {
  return `quotes:${quoteId}`;
}

export async function getCachedRate(pair: string): Promise<FXRate | null> {
  const payload = await getRedisClient().get(rateKey(pair));
  if (!payload) {
    return null;
  }

  const parsed = JSON.parse(payload) as Omit<FXRate, 'timestamp'> & { timestamp: string };
  return {
    ...parsed,
    timestamp: new Date(parsed.timestamp),
  };
}

export async function setCachedRate(rate: FXRate): Promise<void> {
  await getRedisClient().set(
    rateKey(rate.pair),
    JSON.stringify(rate),
    'EX',
    config.FX_RATE_CACHE_TTL_SECONDS,
  );
}

export async function setCachedQuote(quote: FXQuote): Promise<void> {
  const ttlSeconds = Math.max(1, Math.floor((quote.expiresAt.getTime() - Date.now()) / 1000));
  await getRedisClient().set(quoteKey(quote.quoteId), JSON.stringify(quote), 'EX', ttlSeconds);
}

export async function getCachedQuote(quoteId: string): Promise<FXQuote | null> {
  const payload = await getRedisClient().get(quoteKey(quoteId));
  if (!payload) {
    return null;
  }

  const parsed = JSON.parse(payload) as Omit<FXQuote, 'expiresAt'> & { expiresAt: string };
  return {
    ...parsed,
    expiresAt: new Date(parsed.expiresAt),
  };
}
