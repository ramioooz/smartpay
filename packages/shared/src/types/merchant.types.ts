export type MerchantStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export type ApiKeyStatus = 'ACTIVE' | 'DEPRECATED' | 'REVOKED';

export interface Merchant {
  id: string;
  name: string;
  email: string;
  status: MerchantStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface MerchantConfig {
  merchantId: string;
  enabledPSPs: string[];
  preferredCurrencies: string[];
  feeTier: 'standard' | 'premium' | 'enterprise';
  fxSpreadBps: number;
  dailyLimit: number;
  webhooks: Partial<Record<'payment.settled' | 'payment.failed' | 'payment.refunded', string>>;
  routingPreferences: {
    prioritize: 'cost' | 'speed' | 'reliability';
    excludePSPs: string[];
  };
}
