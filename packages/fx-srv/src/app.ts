import express, { Request, Response } from 'express';
import { errorHandler, requestIdMiddleware } from '@smartpay/shared';
import { fxRoutes } from './routes/fx.routes';
import { getHealthStatus } from './services/health.service';

export function createApp(): express.Express {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);

  app.get('/health', async (_req: Request, res: Response) => {
    const health = await getHealthStatus();
    res.status(health.status === 'ok' ? 200 : 503).json(health);
  });

  app.use('/rates', fxRoutes);
  app.use(errorHandler);

  return app;
}
