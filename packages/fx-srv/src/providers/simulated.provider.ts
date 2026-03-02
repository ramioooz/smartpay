import { FXRate } from '@smartpay/shared';
import { FXRateProvider } from './fx-rate-provider.interface';

const BASE_MID_RATES: Record<string, number> = {
  'USD-EUR': 0.92,
  'USD-GBP': 0.79,
  'USD-AED': 3.67,
  'USD-INR': 82.3,
  'USD-BRL': 4.96,
  'USD-PHP': 55.4,
  'EUR-GBP': 0.86,
  'EUR-AED': 3.99,
  'GBP-AED': 4.64,
};

export class SimulatedProvider implements FXRateProvider {
  readonly name = 'simulated';
  private midState: Map<string, number> = new Map(Object.entries(BASE_MID_RATES));

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async fetchRates(pairs: string[]): Promise<FXRate[]> {
    const now = new Date();

    return pairs.map((pair) => {
      const previousMid = this.midState.get(pair) ?? 1;
      const drift = (Math.random() - 0.5) * 0.002;
      const nextMid = Number((previousMid * (1 + drift)).toFixed(6));
      this.midState.set(pair, nextMid);

      const spread = nextMid * 0.00025;
      return {
        pair,
        mid: nextMid,
        bid: nextMid - spread,
        ask: nextMid + spread,
        source: this.name,
        timestamp: now,
      };
    });
  }
}
