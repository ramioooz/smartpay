import { SettledPaymentDocument } from '../models/settled-payment.model';
import { SettlementRecord } from './settlement-provider.interface';

const roundToCents = (value: number) => Math.round(value * 100) / 100;

export function simulateProviderRecords(
  pspName: string,
  internalRecords: SettledPaymentDocument[],
): SettlementRecord[] {
  const records: SettlementRecord[] = [];

  for (const record of internalRecords) {
    if (Math.random() < 0.03) {
      continue;
    }

    const settlementRecord: SettlementRecord = {
      paymentId: record.paymentId,
      pspName,
      pspTransactionId: record.pspTransactionId,
      amount: record.settledAmount,
      currency: record.settledCurrency,
      status: record.status,
      settledAt: record.settledAt,
    };

    if (Math.random() < 0.09) {
      settlementRecord.amount = roundToCents(record.settledAmount + (Math.random() - 0.5) * 0.06);
    }

    if (Math.random() < 0.02) {
      settlementRecord.status = record.status === 'SETTLED' ? 'REFUNDED' : 'SETTLED';
    }

    records.push(settlementRecord);
  }

  if (Math.random() < 0.04) {
    records.push({
      pspName,
      paymentId: `orphan-${Date.now()}`,
      pspTransactionId: `${pspName}-orphan-${Date.now()}`,
      amount: 25 + Math.random() * 500,
      currency: 'USD',
      status: 'SETTLED',
      settledAt: new Date(),
    });
  }

  return records;
}
