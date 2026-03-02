import { createLogger } from '@smartpay/shared';
import { createApp } from './app';
import { config } from './config';
import { startRatePublisher, stopRatePublisher } from './jobs/rate-publisher';
import { rateProviderService } from './services/rate-provider';
import { closeRedisClient } from './services/redis';

const logger = createLogger({ service: 'fx-srv' });

async function bootstrap(): Promise<void> {
  await rateProviderService.initialize();
  await startRatePublisher();

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'fx-srv listening');
  });

  const shutdown = async () => {
    logger.info('fx-srv shutting down');
    server.close(async () => {
      await stopRatePublisher();
      await closeRedisClient();
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

bootstrap().catch(async (error) => {
  logger.error({ error }, 'fx-srv failed to boot');
  await stopRatePublisher();
  await closeRedisClient();
  process.exit(1);
});
