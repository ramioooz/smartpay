import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { paymentController } from '../controllers/payment.controller';

const router: Router = Router();

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

router.post('/', asyncHandler((req, res) => paymentController.createPayment(req, res)));
router.get('/:id', asyncHandler((req, res) => paymentController.getPayment(req, res)));
router.post('/:id/refund', asyncHandler((req, res) => paymentController.initiateRefund(req, res)));

export { router as paymentRoutes };
