import { Collection, ObjectId } from 'mongodb';
import { DiscrepancyType } from '@smartpay/shared';
import { getMongoClient } from '../services/mongo';

export type DiscrepancySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface DiscrepancyDocument {
  _id?: ObjectId;
  reportId: string;
  pspName: string;
  type: DiscrepancyType;
  severity: DiscrepancySeverity;
  paymentId?: string;
  pspTransactionId?: string;
  internalAmount?: number;
  pspAmount?: number;
  internalCurrency?: string;
  pspCurrency?: string;
  internalStatus?: string;
  pspStatus?: string;
  note?: string;
  autoResolved: boolean;
  resolved: boolean;
  resolvedAt?: Date;
  createdAt: Date;
}

export async function discrepancyCollection(): Promise<Collection<DiscrepancyDocument>> {
  const mongo = await getMongoClient();
  return mongo.db('smartpay').collection<DiscrepancyDocument>('discrepancies');
}
