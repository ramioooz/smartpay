import type Redis from 'ioredis';
import { createRedisClient } from '@smartpay/shared';
import { config } from '../config';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = createRedisClient({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      keyPrefix: 'routing:',
    });
  }

  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (!redisClient) {
    return;
  }

  await redisClient.quit();
  redisClient = null;
}
