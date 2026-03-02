import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3002),
  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  KAFKA_BROKERS: z.string().default('kafka:29092'),
  FX_PRIMARY_PROVIDER: z.enum(['frankfurter', 'simulated']).default('frankfurter'),
  FX_FALLBACK_PROVIDER: z.enum(['frankfurter', 'simulated']).default('simulated'),
  FRANKFURTER_BASE_URL: z.string().url().default('https://api.frankfurter.dev/v1'),
  FX_RATE_REFRESH_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  FX_RATE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(30),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid fx-srv configuration: ${JSON.stringify(parsed.error.flatten())}`);
}

export const config = {
  ...parsed.data,
  kafkaBrokers: parsed.data.KAFKA_BROKERS.split(',').map((broker) => broker.trim()),
};
