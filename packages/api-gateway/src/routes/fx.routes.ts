import { Router } from 'express';
import { config } from '../config';
import { proxyRequest } from './proxy';

const router: Router = Router();

router.get('/pairs', async (req, res) => proxyRequest(req, res, config.FX_SRV_URL, '/rates/pairs'));
router.get('/:pair', async (req, res) =>
  proxyRequest(req, res, config.FX_SRV_URL, `/rates/${req.params.pair}`),
);
router.post('/quote', async (req, res) => proxyRequest(req, res, config.FX_SRV_URL, '/rates/quote'));

export { router as fxRoutes };
