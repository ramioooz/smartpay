import { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { redis } from '../services/redis';

type GatewayRequest = Request & {
  apiKey?: string;
};

const WINDOW_MS = 60_000;

export async function rateLimiter(req: GatewayRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.apiKey) {
    next();
    return;
  }

  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const key = `ratelimit:${req.apiKey}`;

  await redis.zremrangebyscore(key, 0, windowStart);
  const current = await redis.zcard(key);

  if (current >= config.GATEWAY_RATE_LIMIT_PER_MINUTE) {
    const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - windowStart)) / 1000);
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      error: `Rate limit exceeded: ${config.GATEWAY_RATE_LIMIT_PER_MINUTE} requests per minute`,
    });
    return;
  }

  await redis.zadd(key, now, `${now}-${Math.random().toString(36).slice(2, 8)}`);
  await redis.expire(key, Math.ceil(WINDOW_MS / 1000));

  next();
}
