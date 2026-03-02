export enum DiscrepancyType {
  MISSING_ON_PSP = 'MISSING_ON_PSP',
  MISSING_INTERNAL = 'MISSING_INTERNAL',
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',
  STATUS_MISMATCH = 'STATUS_MISMATCH',
  CURRENCY_MISMATCH = 'CURRENCY_MISMATCH',
}

export interface ReconciliationRecord {
  paymentId: string;
  pspName: string;
  pspTransactionId: string;
  internalAmount: number;
  internalCurrency: string;
  internalStatus: string;
  pspAmount?: number;
  pspCurrency?: string;
  pspStatus?: string;
  matched: boolean;
  discrepancyType?: DiscrepancyType;
}

export interface ReconciliationReport {
  id: string;
  pspName: string;
  periodStart: Date;
  periodEnd: Date;
  totalInternal: number;
  totalPSP: number;
  matched: number;
  discrepancies: ReconciliationRecord[];
  autoResolved: number;
  needsReview: number;
  createdAt: Date;
}
