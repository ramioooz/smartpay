import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3004),
  ROUTING_DATABASE_URL: z.string().min(1, 'ROUTING_DATABASE_URL is required'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  KAFKA_BROKERS: z.string().default('kafka:29092'),
  PAYMENT_SRV_URL: z.string().url().default('http://payment-srv:3001'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid routing-srv configuration: ${JSON.stringify(parsed.error.flatten())}`);
}

export const config = {
  ...parsed.data,
  kafkaBrokers: parsed.data.KAFKA_BROKERS.split(',').map((broker) => broker.trim()),
};
