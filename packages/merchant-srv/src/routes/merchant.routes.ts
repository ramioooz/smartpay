import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { merchantController } from '../controllers/merchant.controller';

const router: Router = Router();

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

router.get('/verify-key', asyncHandler((req, res) => merchantController.verifyApiKey(req, res)));

router.post('/', asyncHandler((req, res) => merchantController.createMerchant(req, res)));
router.get('/:id', asyncHandler((req, res) => merchantController.getMerchant(req, res)));
router.put('/:id', asyncHandler((req, res) => merchantController.updateMerchant(req, res)));
router.post('/:id/api-keys', asyncHandler((req, res) => merchantController.generateApiKey(req, res)));
router.delete(
  '/:id/api-keys/:keyId',
  asyncHandler((req, res) => merchantController.revokeApiKey(req, res)),
);
router.put('/:id/config', asyncHandler((req, res) => merchantController.updateConfig(req, res)));
router.post('/:id/webhooks', asyncHandler((req, res) => merchantController.registerWebhook(req, res)));

export { router as merchantRoutes };
