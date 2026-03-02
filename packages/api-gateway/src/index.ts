import { createLogger } from '@smartpay/shared';
import { createApp } from './app';
import { config } from './config';
import { redis } from './services/redis';

const logger = createLogger({ service: 'api-gateway' });

async function bootstrap() {
  await redis.ping();

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'api-gateway listening');
  });

  const shutdown = async () => {
    logger.info('api-gateway shutting down');
    server.close(async () => {
      await redis.quit();
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

bootstrap().catch(async (error) => {
  logger.error({ error }, 'api-gateway failed to boot');
  await redis.quit();
  process.exit(1);
});
