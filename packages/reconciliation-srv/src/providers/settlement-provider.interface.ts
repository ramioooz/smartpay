export interface SettlementRecord {
  paymentId?: string;
  pspName: string;
  pspTransactionId: string;
  amount: number;
  currency: string;
  status: 'SETTLED' | 'FAILED' | 'REFUNDED';
  settledAt: Date;
}

export interface SettlementDataProvider {
  readonly pspName: string;
  fetchSettlements(from: Date, to: Date): Promise<SettlementRecord[]>;
  isAvailable(): Promise<boolean>;
}
