import { Request, Response } from 'express';
import { reconciliationService } from '../services/reconciliation.service';
import {
  discrepancyIdParamsSchema,
  listDiscrepanciesSchema,
  listReportsSchema,
  reportIdParamsSchema,
  resolveDiscrepancySchema,
  runSchema,
} from '../validators/reconciliation.validators';

export class ReconciliationController {
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
    const { id: reportId } = reportIdParamsSchema.parse(req.params);

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
    const { id: discrepancyId } = discrepancyIdParamsSchema.parse(req.params);

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
