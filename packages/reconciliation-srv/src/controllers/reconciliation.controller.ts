import { Request, Response } from 'express';
import { z } from 'zod';
import { reconciliationService } from '../services/reconciliation.service';

const runSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  pspName: z.string().min(1).optional(),
});

const listReportsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const listDiscrepanciesSchema = z.object({
  pspName: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  severity: z.string().min(1).optional(),
  resolved: z
    .union([z.literal('true'), z.literal('false')])
    .transform((value: 'true' | 'false') => value === 'true')
    .optional(),
});

const resolveDiscrepancySchema = z.object({
  note: z.string().trim().min(1).max(500).optional(),
});

export class ReconciliationController {
  private readIdParam(value: string | string[] | undefined, label: string): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }

    throw new Error(`${label} is required`);
  }

  async runReconciliation(req: Request, res: Response): Promise<void> {
    const payload = runSchema.parse(req.body ?? {});
    const result = await reconciliationService.runManual(payload);
    res.status(200).json(result);
  }

  async listReports(req: Request, res: Response): Promise<void> {
    const query = listReportsSchema.parse(req.query);
    const result = await reconciliationService.listReports(query.page, query.limit);
    res.status(200).json(result);
  }

  async getReport(req: Request, res: Response): Promise<void> {
    let reportId: string;
    try {
      reportId = this.readIdParam(req.params.id, 'Report id');
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Report id is required' });
      return;
    }

    const report = await reconciliationService.getReportById(reportId);
    if (!report) {
      res.status(404).json({ error: `Reconciliation report ${reportId} was not found` });
      return;
    }

    res.status(200).json(report);
  }

  async listDiscrepancies(req: Request, res: Response): Promise<void> {
    const query = listDiscrepanciesSchema.parse(req.query);
    const data = await reconciliationService.listDiscrepancies(query);
    res.status(200).json({ discrepancies: data });
  }

  async resolveDiscrepancy(req: Request, res: Response): Promise<void> {
    let discrepancyId: string;
    try {
      discrepancyId = this.readIdParam(req.params.id, 'Discrepancy id');
    } catch (error) {
      res
        .status(400)
        .json({ error: error instanceof Error ? error.message : 'Discrepancy id is required' });
      return;
    }

    if (!/^[a-f0-9]{24}$/i.test(discrepancyId)) {
      res.status(400).json({ error: `Discrepancy id ${discrepancyId} is not a valid Mongo ObjectId` });
      return;
    }

    const payload = resolveDiscrepancySchema.parse(req.body ?? {});
    const result = await reconciliationService.resolveDiscrepancy(discrepancyId, payload.note);

    if (!result) {
      res.status(404).json({ error: `Discrepancy ${discrepancyId} was not found` });
      return;
    }

    res.status(200).json(result);
  }
}

export const reconciliationController = new ReconciliationController();
