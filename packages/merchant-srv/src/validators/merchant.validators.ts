import { z } from 'zod';

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
