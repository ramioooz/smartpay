import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { reconciliationController } from '../controllers/reconciliation.controller';

const router: Router = Router();

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

router.post('/run', asyncHandler((req, res) => reconciliationController.runReconciliation(req, res)));
router.get('/reports', asyncHandler((req, res) => reconciliationController.listReports(req, res)));
router.get('/reports/:id', asyncHandler((req, res) => reconciliationController.getReport(req, res)));
router.get('/discrepancies', asyncHandler((req, res) => reconciliationController.listDiscrepancies(req, res)));
router.put('/discrepancies/:id', asyncHandler((req, res) => reconciliationController.resolveDiscrepancy(req, res)));

export { router as reconciliationRoutes };
