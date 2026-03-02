import { createLogger } from '@smartpay/shared';
import { config } from './config';
import { createApp } from './app';
import { startPaymentEventsConsumer } from './consumers/payment-events.consumer';
import { closeMongoClient, getMongoClient } from './services/mongo';
import { prisma } from './services/prisma';

const logger = createLogger({ service: 'merchant-srv' });

async function bootstrap() {
  await prisma.$connect();
  await getMongoClient();
  await startPaymentEventsConsumer();

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'merchant-srv listening');
  });

  const shutdown = async () => {
    logger.info('merchant-srv shutting down');
    server.close(async () => {
      await prisma.$disconnect();
      await closeMongoClient();
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

bootstrap().catch(async (error) => {
  logger.error({ error }, 'merchant-srv failed to boot');
  await prisma.$disconnect();
  await closeMongoClient();
  process.exit(1);
});
