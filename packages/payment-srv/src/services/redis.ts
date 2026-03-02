import { createRedisClient } from '@smartpay/shared';
import type Redis from 'ioredis';
import { config } from '../config';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = createRedisClient({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      keyPrefix: 'payment:',
    });
  }

  return redisClient;
}

export async function disconnectRedisClient(): Promise<void> {
  if (!redisClient) {
    return;
  }

  await redisClient.quit();
  redisClient = null;
}
