import { createLogger } from '@smartpay/shared';
import { getRedisClient } from './redis';
import { rateProviderService } from './rate-provider';

const logger = createLogger({ service: 'fx-srv', component: 'health' });

export async function getHealthStatus(): Promise<{
  status: 'ok' | 'degraded';
  service: 'fx-srv';
  checks: { redis: 'up' | 'down'; provider: string };
}> {
  let redis: 'up' | 'down' = 'down';

  try {
    await getRedisClient().ping();
    redis = 'up';
  } catch (error) {
    logger.warn({ error }, 'Redis health check failed');
  }

  return {
    status: redis === 'up' ? 'ok' : 'degraded',
    service: 'fx-srv',
    checks: {
      redis,
      provider: rateProviderService.getActiveProviderName(),
    },
  };
}
