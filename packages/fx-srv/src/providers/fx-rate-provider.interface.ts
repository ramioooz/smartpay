import { FXRate } from '@smartpay/shared';

export interface FXRateProvider {
  readonly name: string;
  fetchRates(pairs: string[]): Promise<FXRate[]>;
  isAvailable(): Promise<boolean>;
}
