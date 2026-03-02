import { createLogger } from '@smartpay/shared';
import { getMongoClient } from './mongo';
import { getRedisClient } from './redis';

const logger = createLogger({ service: 'reconciliation-srv', component: 'health' });

export async function getHealthStatus(): Promise<{
  status: 'ok' | 'degraded';
  service: 'reconciliation-srv';
  checks: { mongo: 'up' | 'down'; redis: 'up' | 'down' };
}> {
  let mongo: 'up' | 'down' = 'down';
  let redis: 'up' | 'down' = 'down';

  try {
    await (await getMongoClient()).db('admin').command({ ping: 1 });
    mongo = 'up';
  } catch (error) {
    logger.warn({ error }, 'Mongo health check failed');
  }

  try {
    await getRedisClient().ping();
    redis = 'up';
  } catch (error) {
    logger.warn({ error }, 'Redis health check failed');
  }

  return {
    status: mongo === 'up' && redis === 'up' ? 'ok' : 'degraded',
    service: 'reconciliation-srv',
    checks: { mongo, redis },
  };
}
