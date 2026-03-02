import { NextFunction, Request, Response } from 'express';
import { createLogger } from '@smartpay/shared';

const logger = createLogger({ service: 'api-gateway' });

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    logger.info(
      {
        requestId: req.header('X-Request-ID'),
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
      },
      'gateway request completed',
    );
  });

  next();
}
