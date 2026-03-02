import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3003),
  MERCHANT_DATABASE_URL: z.string().min(1, 'MERCHANT_DATABASE_URL is required'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  KAFKA_BROKERS: z.string().default('kafka:29092'),
  WEBHOOK_HMAC_SALT: z.string().default('merchant-webhook-dev-salt'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid merchant-srv configuration: ${JSON.stringify(parsed.error.flatten())}`);
}

export const config = {
  ...parsed.data,
  kafkaBrokers: parsed.data.KAFKA_BROKERS.split(',').map((broker: string) => broker.trim()),
};
