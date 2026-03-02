import { createLogger } from '@smartpay/shared';
import mongoose from 'mongoose';
import { pspAdapterRegistry } from '../adapters/registry';
import { prisma } from './prisma';
import { getRedisClient } from './redis';

const logger = createLogger({ service: 'payment-srv', component: 'health' });

export type HealthPayload = {
  status: 'ok' | 'degraded';
  service: 'payment-srv';
  checks: {
    postgres: 'up' | 'down';
    mongo: 'up' | 'down';
    redis: 'up' | 'down';
  };
  adapters: Array<{
    name: string;
    healthy: boolean;
    latencyMs: number;
  }>;
};

export async function getHealthStatus(): Promise<HealthPayload> {
  const checks: HealthPayload['checks'] = {
    postgres: 'down',
    mongo: 'down',
    redis: 'down',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = 'up';
  } catch (error) {
    logger.warn({ error }, 'Postgres health check failed');
  }

  checks.mongo = mongoose.connection.readyState === 1 ? 'up' : 'down';

  try {
    await getRedisClient().ping();
    checks.redis = 'up';
  } catch (error) {
    logger.warn({ error }, 'Redis health check failed');
  }

  const adapters = await Promise.all(
    pspAdapterRegistry.getAllAdapters().map(async (adapter) => {
      try {
        const status = await adapter.performHealthCheck();
        return {
          name: adapter.name,
          healthy: status.healthy,
          latencyMs: status.latencyMs,
        };
      } catch (error) {
        logger.warn({ error, adapter: adapter.name }, 'Adapter health check failed');
        return {
          name: adapter.name,
          healthy: false,
          latencyMs: 0,
        };
      }
    }),
  );

  const isCoreHealthy = Object.values(checks).every((value) => value === 'up');
  const isAdapterHealthy = adapters.some((adapter) => adapter.healthy);

  return {
    status: isCoreHealthy && isAdapterHealthy ? 'ok' : 'degraded',
    service: 'payment-srv',
    checks,
    adapters,
  };
}
