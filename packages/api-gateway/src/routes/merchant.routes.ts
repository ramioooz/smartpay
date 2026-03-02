import { Router } from 'express';
import { config } from '../config';
import { proxyRequest } from './proxy';

const publicRouter: Router = Router();
const protectedRouter: Router = Router();

publicRouter.post('/', async (req, res) => proxyRequest(req, res, config.MERCHANT_SRV_URL, '/merchants'));

protectedRouter.get('/:id', async (req, res) =>
  proxyRequest(req, res, config.MERCHANT_SRV_URL, `/merchants/${req.params.id}`),
);
protectedRouter.put('/:id', async (req, res) =>
  proxyRequest(req, res, config.MERCHANT_SRV_URL, `/merchants/${req.params.id}`),
);
protectedRouter.post('/:id/api-keys', async (req, res) =>
  proxyRequest(req, res, config.MERCHANT_SRV_URL, `/merchants/${req.params.id}/api-keys`),
);

export { publicRouter as merchantPublicRoutes, protectedRouter as merchantProtectedRoutes };
