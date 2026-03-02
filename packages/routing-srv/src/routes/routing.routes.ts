import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { routingController } from '../controllers/routing.controller';

const router: Router = Router();

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

router.post('/route', asyncHandler((req, res) => routingController.route(req, res)));
router.get('/health/:pspName', asyncHandler((req, res) => routingController.getPspHealth(req, res)));
router.get('/rules', asyncHandler((req, res) => routingController.listRules(req, res)));
router.post('/rules', asyncHandler((req, res) => routingController.createRule(req, res)));
router.put('/rules/:id', asyncHandler((req, res) => routingController.updateRule(req, res)));
router.delete('/rules/:id', asyncHandler((req, res) => routingController.deactivateRule(req, res)));

export { router as routingRoutes };
