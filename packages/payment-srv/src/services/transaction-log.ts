import { TransactionLogModel } from '../models/transaction-log.model';

export type TransactionLogInput = {
  paymentId: string;
  event: string;
  fromStatus?: string;
  toStatus?: string;
  pspName?: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
  correlationId: string;
};

export async function appendTransactionLog(input: TransactionLogInput): Promise<void> {
  await TransactionLogModel.create({
    ...input,
    timestamp: new Date(),
  });
}
