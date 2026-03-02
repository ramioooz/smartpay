import { getMongoClient } from './mongo';
import { prisma } from './prisma';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  service: 'merchant-srv';
  checks: {
    postgres: 'up' | 'down';
    mongo: 'up' | 'down';
  };
}

export async function getHealthStatus(): Promise<HealthStatus> {
  let postgres: 'up' | 'down' = 'up';
  let mongo: 'up' | 'down' = 'up';

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

  return {
    status: postgres === 'up' && mongo === 'up' ? 'ok' : 'degraded',
    service: 'merchant-srv',
    checks: {
      postgres,
      mongo,
    },
  };
}
