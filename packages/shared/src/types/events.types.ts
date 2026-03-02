export interface PaymentCreatedEvent {
  paymentId: string;
  merchantId: string;
  amount: number;
  currency: string;
  targetCurrency: string;
  timestamp: string;
}

export interface PaymentRoutedEvent {
  paymentId: string;
  pspName: string;
  score: number;
  reason: string;
  timestamp: string;
}

export interface PaymentSettledEvent {
  paymentId: string;
  pspName: string;
  pspTransactionId: string;
  settledAmount: number;
  settledCurrency: string;
  timestamp: string;
}

export interface PaymentFailedEvent {
  paymentId: string;
  pspName: string;
  reason: string;
  willRetry: boolean;
  timestamp: string;
}

export interface FXRateUpdatedEvent {
  pair: string;
  bid: number;
  ask: number;
  mid: number;
  source: string;
  timestamp: string;
}

export interface ReconciliationCompletedEvent {
  reportId: string;
  pspName: string;
  matched: number;
  discrepancies: number;
  timestamp: string;
}
