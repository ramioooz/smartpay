import axios from 'axios';
import { FXRate } from '@smartpay/shared';
import { config } from '../config';
import { FXRateProvider } from './fx-rate-provider.interface';

type FrankfurterPayload = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

export class FrankfurterProvider implements FXRateProvider {
  readonly name = 'frankfurter';

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${config.FRANKFURTER_BASE_URL}/latest`, {
        params: { base: 'USD', symbols: 'EUR' },
        timeout: 5_000,
      });
      return true;
    } catch {
      return false;
    }
  }

  async fetchRates(pairs: string[]): Promise<FXRate[]> {
    const now = new Date();
    const groupedByBase = this.groupByBase(pairs);
    const rates: FXRate[] = [];

    for (const [base, symbols] of groupedByBase.entries()) {
      const response = await axios.get<FrankfurterPayload>(`${config.FRANKFURTER_BASE_URL}/latest`, {
        params: {
          base,
          symbols: symbols.join(','),
        },
        timeout: 5_000,
      });

      if (!response.data?.rates) {
        throw new Error(`Frankfurter returned malformed payload for base ${base}`);
      }

      for (const symbol of symbols) {
        const mid = response.data.rates[symbol];
        if (typeof mid !== 'number' || Number.isNaN(mid) || mid <= 0) {
          throw new Error(`Frankfurter returned invalid rate for ${base}-${symbol}`);
        }

        const spread = mid * 0.0002;
        rates.push({
          pair: `${base}-${symbol}`,
          mid,
          bid: mid - spread,
          ask: mid + spread,
          source: this.name,
          timestamp: now,
        });
      }
    }

    return rates;
  }

  private groupByBase(pairs: string[]): Map<string, string[]> {
    const grouped = new Map<string, string[]>();

    for (const pair of pairs) {
      const [base, quote] = pair.split('-');
      if (!base || !quote) {
        continue;
      }

      const existing = grouped.get(base) ?? [];
      if (!existing.includes(quote)) {
        existing.push(quote);
      }
      grouped.set(base, existing);
    }

    return grouped;
  }
}
