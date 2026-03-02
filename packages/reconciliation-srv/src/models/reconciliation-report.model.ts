import { Collection } from 'mongodb';
import { getMongoClient } from '../services/mongo';

export interface ReconciliationReportDocument {
  _id?: string;
  pspName: string;
  periodStart: Date;
  periodEnd: Date;
  totalInternal: number;
  totalPSP: number;
  matched: number;
  matchRate: number;
  discrepancyCount: number;
  discrepancyBreakdown: Record<string, number>;
  createdAt: Date;
}

export async function reconciliationReportCollection(): Promise<Collection<ReconciliationReportDocument>> {
  const mongo = await getMongoClient();
  return mongo.db('smartpay').collection<ReconciliationReportDocument>('reconciliation_reports');
}
