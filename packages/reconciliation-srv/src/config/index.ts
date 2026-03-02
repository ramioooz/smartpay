import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3005),
  MONGO_URI: z.string().min(1).default('mongodb://mongodb:27017/smartpay'),
  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  KAFKA_BROKERS: z.string().default('kafka:29092'),
  RECON_HOURLY_CRON: z.string().default('0 * * * *'),
  RECON_DAILY_CRON: z.string().default('30 0 * * *'),
  RECON_DEFAULT_LOOKBACK_MINUTES: z.coerce.number().int().positive().default(60),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid reconciliation-srv configuration: ${JSON.stringify(parsed.error.flatten())}`);
}

export const config = {
  ...parsed.data,
  kafkaBrokers: parsed.data.KAFKA_BROKERS.split(',').map((broker: string) => broker.trim()),
};
