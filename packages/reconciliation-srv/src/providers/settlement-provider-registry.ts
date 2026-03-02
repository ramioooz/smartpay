import { createLogger } from '@smartpay/shared';
import { SettledPaymentDocument } from '../models/settled-payment.model';
import { CheckoutSettlementProvider } from './checkout-settlement.provider';
import { CryptoRailSettlementProvider } from './crypto-rail-settlement.provider';
import { SettlementDataProvider } from './settlement-provider.interface';
import { StripeSettlementProvider } from './stripe-settlement.provider';
import { WiseSettlementProvider } from './wise-settlement.provider';

const logger = createLogger({ service: 'reconciliation-srv', component: 'settlement-provider-registry' });

export class SettlementProviderRegistry {
  private providers = new Map<string, SettlementDataProvider>();

  registerProvider(provider: SettlementDataProvider): void {
    this.providers.set(provider.pspName, provider);
  }

  resolveProvider(pspName: string): SettlementDataProvider | undefined {
    return this.providers.get(pspName);
  }

  getAllProviders(): SettlementDataProvider[] {
    return [...this.providers.values()];
  }

  initialize(getInternalRecords: (pspName: string, from: Date, to: Date) => Promise<SettledPaymentDocument[]>): void {
    this.providers.clear();

    this.registerProvider(
      new StripeSettlementProvider((from, to) => getInternalRecords('stripe', from, to)),
    );
    this.registerProvider(
      new WiseSettlementProvider((from, to) => getInternalRecords('wise', from, to)),
    );
    this.registerProvider(
      new CheckoutSettlementProvider((from, to) => getInternalRecords('checkout', from, to)),
    );
    this.registerProvider(
      new CryptoRailSettlementProvider((from, to) => getInternalRecords('crypto-rail', from, to)),
    );

    logger.info({ providers: this.getAllProviders().map((provider) => provider.pspName) }, 'Settlement providers initialized');
  }
}

export const settlementProviderRegistry = new SettlementProviderRegistry();
