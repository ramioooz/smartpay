import { getMongoClient } from './mongo';
import { prisma } from './prisma';
import { getRedisClient } from './redis';

export async function getHealthStatus(): Promise<{
  status: 'ok' | 'degraded';
  service: 'routing-srv';
  checks: { postgres: 'up' | 'down'; mongo: 'up' | 'down'; redis: 'up' | 'down' };
}> {
  let postgres: 'up' | 'down' = 'up';
  let mongo: 'up' | 'down' = 'up';
  let redis: 'up' | 'down' = 'up';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    postgres = 'down';
  }

  try {
    const client = await getMongoClient();
    await client.db('smartpay').command({ ping: 1 });
  } catch {
    mongo = 'down';
  }

  try {
    await getRedisClient().ping();
  } catch {
    redis = 'down';
  }

  return {
    status: postgres === 'up' && mongo === 'up' && redis === 'up' ? 'ok' : 'degraded',
    service: 'routing-srv',
    checks: { postgres, mongo, redis },
  };
}
