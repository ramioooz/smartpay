export type FeeTier = 'standard' | 'premium' | 'enterprise';

export interface MerchantConfigDocument {
  merchantId: string;
  enabledPSPs: string[];
  preferredCurrencies: string[];
  feeTier: FeeTier;
  fxSpreadBps: number;
  dailyLimit: number;
  webhooks: Partial<Record<'payment.settled' | 'payment.failed' | 'payment.refunded', string>>;
  routingPreferences: {
    prioritize: 'cost' | 'speed' | 'reliability';
    excludePSPs: string[];
  };
  updatedAt: Date;
}

export const DEFAULT_MERCHANT_CONFIG: Omit<MerchantConfigDocument, 'merchantId' | 'updatedAt'> = {
  enabledPSPs: ['stripe', 'wise', 'checkout', 'crypto-rail'],
  preferredCurrencies: ['USD', 'EUR', 'GBP', 'AED'],
  feeTier: 'standard',
  fxSpreadBps: 50,
  dailyLimit: 1_000_000,
  webhooks: {},
  routingPreferences: {
    prioritize: 'reliability',
    excludePSPs: [],
  },
};
