import Redis from 'ioredis';
import { config } from '../config';

export const redis = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  keyPrefix: 'gateway:',
  maxRetriesPerRequest: null,
  retryStrategy: (attempt: number) => Math.min(250 * 2 ** attempt, 5000),
});
