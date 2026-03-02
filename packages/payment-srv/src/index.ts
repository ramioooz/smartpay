import { createLogger } from '@smartpay/shared';
import { createApp } from './app';
import { pspAdapterRegistry } from './adapters/registry';
import { config } from './config';
import { startRoutingResultConsumer } from './consumers/routing-result.consumer';
import { connectMongoForPayment, disconnectMongoForPayment } from './services/mongo';
import { paymentOrchestrator } from './services/orchestrator';
import { prisma } from './services/prisma';
import { disconnectRedisClient } from './services/redis';
import { closeWebhookDispatcher, initWebhookDispatcher } from './services/webhook-dispatch';

const logger = createLogger({ service: 'payment-srv' });

async function bootstrap(): Promise<void> {
  await prisma.$connect();
  await connectMongoForPayment();
  pspAdapterRegistry.initialize();
  await paymentOrchestrator.connect();
  await initWebhookDispatcher();
  await startRoutingResultConsumer();

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'payment-srv listening');
  });

  const shutdown = async () => {
    logger.info('payment-srv shutting down');
    server.close(async () => {
      await paymentOrchestrator.disconnect();
      await closeWebhookDispatcher();
      await prisma.$disconnect();
      await disconnectMongoForPayment();
      await disconnectRedisClient();
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

bootstrap().catch(async (error) => {
  logger.error({ error }, 'payment-srv failed to boot');
  await paymentOrchestrator.disconnect();
  await closeWebhookDispatcher();
  await prisma.$disconnect();
  await disconnectMongoForPayment();
  await disconnectRedisClient();
  process.exit(1);
});
