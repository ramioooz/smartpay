import { Router } from 'express';
import { config } from '../config';
import { proxyRequest } from './proxy';

const router: Router = Router();

router.post('/', async (req, res) => proxyRequest(req, res, config.PAYMENT_SRV_URL, '/payments'));
router.get('/:id', async (req, res) =>
  proxyRequest(req, res, config.PAYMENT_SRV_URL, `/payments/${req.params.id}`),
);
router.post('/:id/refund', async (req, res) =>
  proxyRequest(req, res, config.PAYMENT_SRV_URL, `/payments/${req.params.id}/refund`),
);

export { router as paymentRoutes };
