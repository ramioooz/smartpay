import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { fxController } from '../controllers/fx.controller';

const router: Router = Router();

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

router.get('/pairs', asyncHandler((req, res) => fxController.getPairs(req, res)));
router.post('/quote', asyncHandler((req, res) => fxController.createQuote(req, res)));
router.delete('/quote/:quoteId', asyncHandler((req, res) => fxController.releaseQuote(req, res)));
router.get('/:pair', asyncHandler((req, res) => fxController.getRate(req, res)));

export { router as fxRoutes };
