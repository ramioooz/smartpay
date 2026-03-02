export const SUPPORTED_PAIRS = [
  'USD-EUR',
  'USD-GBP',
  'USD-AED',
  'USD-INR',
  'USD-BRL',
  'USD-PHP',
  'EUR-GBP',
  'EUR-AED',
  'GBP-AED',
] as const;

export type SupportedPair = (typeof SUPPORTED_PAIRS)[number];

export function normalizePair(pair: string): string {
  return pair.toUpperCase().replace('/', '-').replace('_', '-');
}
