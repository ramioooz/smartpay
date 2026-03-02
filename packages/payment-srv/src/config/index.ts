import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  PAYMENT_DATABASE_URL: z.string().min(1, 'PAYMENT_DATABASE_URL is required'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  KAFKA_BROKERS: z.string().default('kafka:29092'),
  ROUTING_SRV_URL: z.string().url().default('http://routing-srv:3004'),
  FX_SRV_URL: z.string().url().default('http://fx-srv:3002'),
  IDEMPOTENCY_LOCK_TTL_SECONDS: z.coerce.number().int().positive().default(30),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid payment-srv configuration: ${JSON.stringify(parsed.error.flatten())}`);
}

export const config = {
  ...parsed.data,
  kafkaBrokers: parsed.data.KAFKA_BROKERS.split(',').map((broker: string) => broker.trim()),
};
