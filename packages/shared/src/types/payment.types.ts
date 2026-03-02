export enum PaymentStatus {
  INITIATED = 'INITIATED',
  ROUTING = 'ROUTING',
  ROUTED = 'ROUTED',
  PROCESSING = 'PROCESSING',
  SUBMITTED = 'SUBMITTED',
  SETTLED = 'SETTLED',
  FAILED = 'FAILED',
  REFUND_INITIATED = 'REFUND_INITIATED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

export interface Payment {
  id: string;
  merchantId: string;
  externalRef: string;
  amount: number;
  currency: string;
  targetCurrency: string;
  targetAmount?: number;
  fxRate?: number;
  pspName?: string;
  pspTransactionId?: string;
  status: PaymentStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Beneficiary {
  name: string;
  accountNumber?: string;
  iban?: string;
  bankCode?: string;
  country: string;
}

export interface CreatePaymentRequest {
  merchantId: string;
  externalRef: string;
  amount: number;
  currency: string;
  targetCurrency: string;
  beneficiary: Beneficiary;
  metadata?: Record<string, unknown>;
}
