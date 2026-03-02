import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  MERCHANT_SRV_URL: z.url(),
  PAYMENT_SRV_URL: z.url(),
  FX_SRV_URL: z.url(),
  ROUTING_SRV_URL: z.url().optional(),
  RECONCILIATION_SRV_URL: z.url().optional(),
  GATEWAY_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(100),
  GATEWAY_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  CORS_ORIGINS: z.string().default('*'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid api-gateway config: ${JSON.stringify(parsed.error.flatten())}`);
}

const raw = parsed.data;

export const config = {
  ...raw,
  corsOrigins: raw.CORS_ORIGINS === '*' ? '*' : raw.CORS_ORIGINS.split(',').map((value) => value.trim()),
};
