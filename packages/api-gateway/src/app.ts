import cors from 'cors';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import { errorHandler, requestIdMiddleware } from '@smartpay/shared';
import { config } from './config';
import { apiKeyAuth } from './middleware/api-key-auth';
import { rateLimiter } from './middleware/rate-limiter';
import { requestLogger } from './middleware/request-logger';
import { fxRoutes } from './routes/fx.routes';
import { merchantProtectedRoutes, merchantPublicRoutes } from './routes/merchant.routes';
import { paymentRoutes } from './routes/payment.routes';
import { httpClient } from './services/http';
import { redis } from './services/redis';

export function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);
  app.use(requestLogger);

  app.get('/health', async (_req: Request, res: Response) => {
    const checks: Record<string, 'up' | 'down'> = {
      redis: 'up',
      merchant: 'up',
      payment: 'up',
      fx: 'up',
    };

    try {
      await redis.ping();
    } catch {
      checks.redis = 'down';
    }

    const downstreams = [
      { key: 'merchant', url: `${config.MERCHANT_SRV_URL}/health` },
      { key: 'payment', url: `${config.PAYMENT_SRV_URL}/health` },
      { key: 'fx', url: `${config.FX_SRV_URL}/health` },
    ] as const;

    await Promise.all(
      downstreams.map(async (service) => {
        try {
          await httpClient.get(service.url);
        } catch {
          checks[service.key] = 'down';
        }
      }),
    );

    const status = Object.values(checks).every((value) => value === 'up') ? 'ok' : 'degraded';

    res.status(status === 'ok' ? 200 : 503).json({
      status,
      service: 'api-gateway',
      checks,
    });
  });

  app.use('/api/v1/merchants', merchantPublicRoutes);

  app.use('/api/v1', apiKeyAuth, rateLimiter);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/rates', fxRoutes);
  app.use('/api/v1/merchants', merchantProtectedRoutes);

  app.use(errorHandler);

  return app;
}
