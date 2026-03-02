import { SettledPaymentDocument } from '../models/settled-payment.model';
import { SettlementDataProvider, SettlementRecord } from './settlement-provider.interface';
import { simulateProviderRecords } from './provider-utils';

export class CryptoRailSettlementProvider implements SettlementDataProvider {
  readonly pspName = 'crypto-rail';

  constructor(
    private readonly getInternalRecords: (from: Date, to: Date) => Promise<SettledPaymentDocument[]>,
  ) {}

  async fetchSettlements(from: Date, to: Date): Promise<SettlementRecord[]> {
    const internalRecords = await this.getInternalRecords(from, to);
    return simulateProviderRecords(this.pspName, internalRecords);
  }

  async isAvailable(): Promise<boolean> {
    return Math.random() > 0.06;
  }
}
