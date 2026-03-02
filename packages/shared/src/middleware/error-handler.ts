import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger';

export function errorHandler(error: unknown, req: Request, res: Response, next: NextFunction): void {
  void next;
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: error.flatten(),
    });
    return;
  }

  logger.error(
    {
      error,
      path: req.path,
      method: req.method,
    },
    'Unhandled request error',
  );

  const message = error instanceof Error ? error.message : 'Unhandled application error';
  const isDev = process.env.NODE_ENV !== 'production';

  res.status(500).json({
    error: message,
    stack: isDev && error instanceof Error ? error.stack : undefined,
  });
}
