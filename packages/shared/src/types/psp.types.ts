export interface PSPAdapter {
  readonly name: string;
  readonly supportedCurrencies: string[];
  readonly supportedCountries: string[];

  submitPayment(request: PSPPaymentRequest): Promise<PSPResponse>;
  getTransactionStatus(pspTransactionId: string): Promise<PSPTransactionStatus>;
  initiateRefund(pspTransactionId: string, amount: number): Promise<PSPRefundResponse>;
  performHealthCheck(): Promise<PSPHealthStatus>;
}

export interface PSPPaymentRequest {
  paymentId: string;
  amount: number;
  currency: string;
  targetCurrency: string;
  targetAmount: number;
  beneficiary: {
    name: string;
    accountNumber?: string;
    iban?: string;
    bankCode?: string;
    country: string;
  };
}

export interface PSPResponse {
  success: boolean;
  pspTransactionId: string;
  status: 'ACCEPTED' | 'PENDING' | 'REJECTED';
  message?: string;
  estimatedSettlement?: Date;
}

export interface PSPTransactionStatus {
  pspTransactionId: string;
  status: 'PENDING' | 'PROCESSING' | 'SETTLED' | 'FAILED' | 'REFUNDED';
  settledAmount?: number;
  settledCurrency?: string;
  updatedAt: Date;
}

export interface PSPRefundResponse {
  success: boolean;
  refundId: string;
  status: 'INITIATED' | 'COMPLETED' | 'FAILED';
  message?: string;
}

export interface PSPHealthStatus {
  healthy: boolean;
  latencyMs: number;
  lastChecked: Date;
  successRate?: number;
}
