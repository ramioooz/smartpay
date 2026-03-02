import { createLogger } from '@smartpay/shared';
import { createApp } from './app';
import { config } from './config';
import { startPaymentOutcomeConsumer, stopPaymentOutcomeConsumer } from './consumers/payment-outcome.consumer';
import { closeMongoClient, getMongoClient } from './services/mongo';
import { prisma } from './services/prisma';
import { closeRedisClient } from './services/redis';

const logger = createLogger({ service: 'routing-srv' });

async function bootstrap(): Promise<void> {
  await prisma.$connect();
  await getMongoClient();
  await startPaymentOutcomeConsumer();

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'routing-srv listening');
  });

  const shutdown = async () => {
    logger.info('routing-srv shutting down');
    server.close(async () => {
      await stopPaymentOutcomeConsumer();
      await prisma.$disconnect();
      await closeMongoClient();
      await closeRedisClient();
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

bootstrap().catch(async (error) => {
  logger.error({ error }, 'routing-srv failed to boot');
  await stopPaymentOutcomeConsumer();
  await prisma.$disconnect();
  await closeMongoClient();
  await closeRedisClient();
  process.exit(1);
});
