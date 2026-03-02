import { createLogger } from '@smartpay/shared';
import { settledPaymentCollection, SettledPaymentDocument } from '../models/settled-payment.model';
import { settlementProviderRegistry } from '../providers/settlement-provider-registry';
import { SettlementRecord } from '../providers/settlement-provider.interface';

const logger = createLogger({ service: 'reconciliation-srv', component: 'settlement-fetcher' });

export class SettlementFetcher {
  initialize(): void {
    settlementProviderRegistry.initialize((pspName, from, to) =>
      this.getInternalSettlements(pspName, from, to),
    );
  }

  async fetchSettlementsByPsp(pspNames: string[], from: Date, to: Date): Promise<Map<string, SettlementRecord[]>> {
    const results = new Map<string, SettlementRecord[]>();

    for (const pspName of pspNames) {
      const provider = settlementProviderRegistry.resolveProvider(pspName);
      if (!provider) {
        logger.warn({ pspName }, `No settlement provider registered for PSP ${pspName}`);
        results.set(pspName, []);
        continue;
      }

      const available = await provider.isAvailable();
      if (!available) {
        logger.warn({ pspName }, `Settlement provider ${pspName} is currently unavailable`);
        results.set(pspName, []);
        continue;
      }

      const records = await provider.fetchSettlements(from, to);
      results.set(pspName, records);
    }

    return results;
  }

  async getInternalSettlements(pspName: string, from: Date, to: Date): Promise<SettledPaymentDocument[]> {
    const collection = await settledPaymentCollection();

    return collection
      .find({
        pspName,
        settledAt: {
          $gte: from,
          $lte: to,
        },
      })
      .toArray();
  }

  async listActivePspNames(from: Date, to: Date): Promise<string[]> {
    const collection = await settledPaymentCollection();
    const pspNames = await collection.distinct('pspName', {
      settledAt: {
        $gte: from,
        $lte: to,
      },
    });

    return pspNames.filter(
      (pspName: unknown): pspName is string => typeof pspName === 'string' && pspName.length > 0,
    );
  }
}

export const settlementFetcher = new SettlementFetcher();
