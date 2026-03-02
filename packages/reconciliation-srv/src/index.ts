import { createLogger } from '@smartpay/shared';
import { createApp } from './app';
import { config } from './config';
import { startPaymentSettledConsumer } from './consumers/payment-settled.consumer';
import { startReconciliationScheduler, stopReconciliationScheduler } from './jobs/reconciliation-scheduler';
import { closeKafkaConnections } from './services/kafka';
import { closeMongoClient, getMongoClient } from './services/mongo';
import { closeRedisClient } from './services/redis';
import { settlementFetcher } from './services/settlement-fetcher';

const logger = createLogger({ service: 'reconciliation-srv' });

async function bootstrap(): Promise<void> {
  await getMongoClient();
  settlementFetcher.initialize();
  await startPaymentSettledConsumer();
  startReconciliationScheduler();

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'reconciliation-srv listening');
  });

  const shutdown = async () => {
    logger.info('reconciliation-srv shutting down');
    server.close(async () => {
      stopReconciliationScheduler();
      await closeKafkaConnections();
      await closeMongoClient();
      await closeRedisClient();
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

bootstrap().catch(async (error) => {
  logger.error({ error }, 'reconciliation-srv failed to boot');
  stopReconciliationScheduler();
  await closeKafkaConnections();
  await closeMongoClient();
  await closeRedisClient();
  process.exit(1);
});
