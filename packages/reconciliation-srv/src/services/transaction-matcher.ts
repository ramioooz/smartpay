import {
  createLogger,
  DiscrepancyType,
  ReconciliationRecord,
} from '@smartpay/shared';
import { SettlementRecord } from '../providers/settlement-provider.interface';
import { saveReconciliationReport } from './report-generator';
import { settlementFetcher } from './settlement-fetcher';

const logger = createLogger({ service: 'reconciliation-srv', component: 'transaction-matcher' });

function asKey(pspTransactionId: string): string {
  return pspTransactionId.trim().toLowerCase();
}

export class TransactionMatcher {
  async run(params: { from: Date; to: Date; pspName?: string }) {
    const pspNames = params.pspName
      ? [params.pspName]
      : await settlementFetcher.listActivePspNames(params.from, params.to);

    const settlementsByPsp = await settlementFetcher.fetchSettlementsByPsp(pspNames, params.from, params.to);
    const reports: Array<{
      reportId: string;
      pspName: string;
      totalInternal: number;
      totalPSP: number;
      matched: number;
      discrepancyCount: number;
      autoResolved: number;
      needsReview: number;
    }> = [];

    for (const pspName of pspNames) {
      const internal = await settlementFetcher.getInternalSettlements(pspName, params.from, params.to);
      const pspSettlements = settlementsByPsp.get(pspName) ?? [];

      const reconciliation = this.matchByPsp(pspName, internal, pspSettlements);
      const reportResult = await saveReconciliationReport({
        pspName,
        periodStart: params.from,
        periodEnd: params.to,
        totalInternal: internal.length,
        totalPSP: pspSettlements.length,
        matched: reconciliation.matched,
        discrepancies: reconciliation.discrepancies,
      });

      reports.push({
        reportId: reportResult.reportId,
        pspName,
        totalInternal: internal.length,
        totalPSP: pspSettlements.length,
        matched: reconciliation.matched,
        discrepancyCount: reportResult.discrepancyCount,
        autoResolved: reportResult.autoResolved,
        needsReview: reportResult.needsReview,
      });
    }

    logger.info({ reports: reports.length }, 'Reconciliation run completed');

    return {
      periodStart: params.from,
      periodEnd: params.to,
      reports,
    };
  }

  private matchByPsp(
    pspName: string,
    internalRecords: Array<{
      paymentId: string;
      pspTransactionId: string;
      settledAmount: number;
      settledCurrency: string;
      status: 'SETTLED' | 'REFUNDED';
    }>,
    pspRecords: SettlementRecord[],
  ): { matched: number; discrepancies: ReconciliationRecord[] } {
    const internalByTxId = new Map(internalRecords.map((record) => [asKey(record.pspTransactionId), record]));
    const pspByTxId = new Map(pspRecords.map((record) => [asKey(record.pspTransactionId), record]));

    const discrepancies: ReconciliationRecord[] = [];
    let matched = 0;

    for (const internal of internalRecords) {
      const pspRecord = pspByTxId.get(asKey(internal.pspTransactionId));
      if (!pspRecord) {
        discrepancies.push({
          paymentId: internal.paymentId,
          pspName,
          pspTransactionId: internal.pspTransactionId,
          internalAmount: internal.settledAmount,
          internalCurrency: internal.settledCurrency,
          internalStatus: internal.status,
          matched: false,
          discrepancyType: DiscrepancyType.MISSING_ON_PSP,
        });
        continue;
      }

      const amountDiff = Math.abs(internal.settledAmount - pspRecord.amount);
      if (amountDiff >= 0.01) {
        discrepancies.push({
          paymentId: internal.paymentId,
          pspName,
          pspTransactionId: internal.pspTransactionId,
          internalAmount: internal.settledAmount,
          internalCurrency: internal.settledCurrency,
          internalStatus: internal.status,
          pspAmount: pspRecord.amount,
          pspCurrency: pspRecord.currency,
          pspStatus: pspRecord.status,
          matched: false,
          discrepancyType: DiscrepancyType.AMOUNT_MISMATCH,
        });
        continue;
      }

      if (internal.status !== pspRecord.status) {
        discrepancies.push({
          paymentId: internal.paymentId,
          pspName,
          pspTransactionId: internal.pspTransactionId,
          internalAmount: internal.settledAmount,
          internalCurrency: internal.settledCurrency,
          internalStatus: internal.status,
          pspAmount: pspRecord.amount,
          pspCurrency: pspRecord.currency,
          pspStatus: pspRecord.status,
          matched: false,
          discrepancyType: DiscrepancyType.STATUS_MISMATCH,
        });
        continue;
      }

      if (internal.settledCurrency !== pspRecord.currency) {
        discrepancies.push({
          paymentId: internal.paymentId,
          pspName,
          pspTransactionId: internal.pspTransactionId,
          internalAmount: internal.settledAmount,
          internalCurrency: internal.settledCurrency,
          internalStatus: internal.status,
          pspAmount: pspRecord.amount,
          pspCurrency: pspRecord.currency,
          pspStatus: pspRecord.status,
          matched: false,
          discrepancyType: DiscrepancyType.CURRENCY_MISMATCH,
        });
        continue;
      }

      matched += 1;
    }

    for (const pspRecord of pspRecords) {
      if (internalByTxId.has(asKey(pspRecord.pspTransactionId))) {
        continue;
      }

      discrepancies.push({
        paymentId: pspRecord.paymentId ?? `external-${pspRecord.pspTransactionId}`,
        pspName,
        pspTransactionId: pspRecord.pspTransactionId,
        internalAmount: 0,
        internalCurrency: '',
        internalStatus: '',
        pspAmount: pspRecord.amount,
        pspCurrency: pspRecord.currency,
        pspStatus: pspRecord.status,
        matched: false,
        discrepancyType: DiscrepancyType.MISSING_INTERNAL,
      });
    }

    return {
      matched,
      discrepancies,
    };
  }
}

export const transactionMatcher = new TransactionMatcher();
