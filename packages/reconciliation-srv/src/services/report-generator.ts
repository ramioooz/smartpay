import { randomUUID } from 'node:crypto';
import {
  createLogger,
  DiscrepancyType,
  ReconciliationCompletedEvent,
  ReconciliationRecord,
  TOPICS,
} from '@smartpay/shared';
import { discrepancyCollection, DiscrepancyDocument } from '../models/discrepancy.model';
import {
  reconciliationReportCollection,
  ReconciliationReportDocument,
} from '../models/reconciliation-report.model';
import { getKafkaProducer } from './kafka';

const logger = createLogger({ service: 'reconciliation-srv', component: 'report-generator' });

function resolveSeverity(type: DiscrepancyType): DiscrepancyDocument['severity'] {
  if (type === DiscrepancyType.MISSING_INTERNAL) return 'CRITICAL';
  if (type === DiscrepancyType.MISSING_ON_PSP || type === DiscrepancyType.STATUS_MISMATCH) return 'HIGH';
  if (type === DiscrepancyType.AMOUNT_MISMATCH) return 'MEDIUM';
  return 'LOW';
}

export async function saveReconciliationReport(input: {
  pspName: string;
  periodStart: Date;
  periodEnd: Date;
  totalInternal: number;
  totalPSP: number;
  matched: number;
  discrepancies: ReconciliationRecord[];
}): Promise<{ reportId: string; discrepancyCount: number; autoResolved: number; needsReview: number }> {
  const reportId = randomUUID();
  const discrepancyCount = input.discrepancies.length;
  const autoResolved = input.discrepancies.filter(
    (item) => item.discrepancyType === DiscrepancyType.AMOUNT_MISMATCH &&
      Math.abs((item.internalAmount ?? 0) - (item.pspAmount ?? 0)) < 0.01,
  ).length;
  const needsReview = discrepancyCount - autoResolved;

  const report: ReconciliationReportDocument = {
    pspName: input.pspName,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    totalInternal: input.totalInternal,
    totalPSP: input.totalPSP,
    matched: input.matched,
    matchRate: input.totalInternal === 0 ? 1 : input.matched / input.totalInternal,
    discrepancyCount,
    discrepancyBreakdown: input.discrepancies.reduce<Record<string, number>>((acc, item) => {
      const key = item.discrepancyType ?? 'UNKNOWN';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
    createdAt: new Date(),
  };

  const reportCollection = await reconciliationReportCollection();
  await reportCollection.insertOne({
    _id: reportId,
    ...report,
  });

  if (input.discrepancies.length > 0) {
    const collection = await discrepancyCollection();
    const documents: DiscrepancyDocument[] = input.discrepancies.map((item) => {
      const type = item.discrepancyType ?? DiscrepancyType.STATUS_MISMATCH;
      const autoResolvedItem = type === DiscrepancyType.AMOUNT_MISMATCH &&
        Math.abs((item.internalAmount ?? 0) - (item.pspAmount ?? 0)) < 0.01;

      return {
        reportId,
        pspName: item.pspName,
        type,
        severity: resolveSeverity(type),
        paymentId: item.paymentId,
        pspTransactionId: item.pspTransactionId,
        internalAmount: item.internalAmount,
        pspAmount: item.pspAmount,
        internalCurrency: item.internalCurrency,
        pspCurrency: item.pspCurrency,
        internalStatus: item.internalStatus,
        pspStatus: item.pspStatus,
        autoResolved: autoResolvedItem,
        resolved: autoResolvedItem,
        resolvedAt: autoResolvedItem ? new Date() : undefined,
        note: autoResolvedItem ? 'Auto-resolved as FX rounding difference under $0.01' : undefined,
        createdAt: new Date(),
      };
    });

    await collection.insertMany(documents);
  }

  const producer = await getKafkaProducer();
  const completedEvent: ReconciliationCompletedEvent = {
    reportId,
    pspName: input.pspName,
    matched: input.matched,
    discrepancies: discrepancyCount,
    timestamp: new Date().toISOString(),
  };

  await producer.publish(TOPICS.RECONCILIATION_COMPLETED, completedEvent);

  for (const item of input.discrepancies) {
    if (!item.discrepancyType) {
      continue;
    }

    await producer.publish(TOPICS.RECONCILIATION_DISCREPANCY, {
      reportId,
      paymentId: item.paymentId,
      pspName: item.pspName,
      discrepancyType: item.discrepancyType,
      timestamp: new Date().toISOString(),
    });
  }

  logger.info({ reportId, pspName: input.pspName, discrepancyCount }, 'Reconciliation report generated');

  return {
    reportId,
    discrepancyCount,
    autoResolved,
    needsReview,
  };
}
