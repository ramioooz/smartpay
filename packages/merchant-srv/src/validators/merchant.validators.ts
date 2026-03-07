import { z } from 'zod';

const requiredParamSchema = z.preprocess(
  (value) => (Array.isArray(value) ? value[0] : value),
  z.string().min(1),
);

export const createMerchantSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
});

export const updateMerchantSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
});

export const upsertConfigSchema = z.object({
  enabledPSPs: z.array(z.string()).optional(),
  preferredCurrencies: z.array(z.string()).optional(),
  feeTier: z.enum(['standard', 'premium', 'enterprise']).optional(),
  fxSpreadBps: z.number().int().nonnegative().optional(),
  dailyLimit: z.number().positive().optional(),
  webhooks: z
    .object({
      'payment.settled': z.url().optional(),
      'payment.failed': z.url().optional(),
      'payment.refunded': z.url().optional(),
    })
    .optional(),
  routingPreferences: z
    .object({
      prioritize: z.enum(['cost', 'speed', 'reliability']).optional(),
      excludePSPs: z.array(z.string()).optional(),
    })
    .optional(),
});

export const webhookSchema = z.object({
  event: z.enum(['payment.settled', 'payment.failed', 'payment.refunded']),
  url: z.url(),
});

export const merchantIdParamsSchema = z.object({
  id: requiredParamSchema,
});

export const merchantKeyParamsSchema = z.object({
  id: requiredParamSchema,
  keyId: requiredParamSchema,
});

export const apiKeyHeaderSchema = z.string().min(1);
