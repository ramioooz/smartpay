import { Collection } from 'mongodb';
import { getMongoClient } from '../services/mongo';

export interface SettledPaymentDocument {
  paymentId: string;
  merchantId?: string;
  pspName: string;
  pspTransactionId: string;
  settledAmount: number;
  settledCurrency: string;
  status: 'SETTLED' | 'REFUNDED';
  settledAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export async function settledPaymentCollection(): Promise<Collection<SettledPaymentDocument>> {
  const mongo = await getMongoClient();
  return mongo.db('smartpay').collection<SettledPaymentDocument>('settled_payments');
}
