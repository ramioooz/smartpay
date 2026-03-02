import { ObjectId } from 'mongodb';
import { discrepancyCollection } from '../models/discrepancy.model';
import { reconciliationReportCollection } from '../models/reconciliation-report.model';
import { transactionMatcher } from './transaction-matcher';

export class ReconciliationService {
  async runManual(input: { from?: Date; to?: Date; pspName?: string }) {
    const to = input.to ?? new Date();
    const from = input.from ?? new Date(to.getTime() - 60 * 60 * 1000);

    return transactionMatcher.run({
      from,
      to,
      pspName: input.pspName,
    });
  }

  async listReports(page: number, limit: number) {
    const collection = await reconciliationReportCollection();

    const reports = await collection
      .find({})
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const total = await collection.countDocuments({});

    return {
      page,
      limit,
      total,
      reports,
    };
  }

  async getReportById(id: string) {
    const collection = await reconciliationReportCollection();
    const report = await collection.findOne({ _id: id });
    if (!report) {
      return null;
    }

    const discrepancies = await (await discrepancyCollection())
      .find({ reportId: id })
      .sort({ createdAt: -1 })
      .toArray();

    return {
      report,
      discrepancies,
    };
  }

  async listDiscrepancies(filters: {
    pspName?: string;
    type?: string;
    severity?: string;
    resolved?: boolean;
  }) {
    const query: Record<string, unknown> = {};
    if (filters.pspName) query.pspName = filters.pspName;
    if (filters.type) query.type = filters.type;
    if (filters.severity) query.severity = filters.severity;
    if (filters.resolved !== undefined) query.resolved = filters.resolved;

    return (await discrepancyCollection())
      .find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
  }

  async resolveDiscrepancy(id: string, note?: string) {
    const collection = await discrepancyCollection();
    const _id = new ObjectId(id);

    const result = await collection.findOneAndUpdate(
      { _id },
      {
        $set: {
          resolved: true,
          resolvedAt: new Date(),
          note,
        },
      },
      { returnDocument: 'after' },
    );

    return result;
  }
}

export const reconciliationService = new ReconciliationService();
