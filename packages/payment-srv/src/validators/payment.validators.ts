import { z } from 'zod';

export const createPaymentSchema = z.object({
  merchantId: z.string().uuid(),
  externalRef: z.string().min(1).max(255),
  amount: z.number().positive(),
  currency: z.string().length(3),
  targetCurrency: z.string().length(3),
  beneficiary: z.object({
    name: z.string().min(1),
    accountNumber: z.string().optional(),
    iban: z.string().optional(),
    bankCode: z.string().optional(),
    country: z.string().length(2),
  }),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const paymentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const refundSchema = z.object({
  amount: z.number().positive(),
});
