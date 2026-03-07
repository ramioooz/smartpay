import { z } from 'zod';

export const routeSchema = z.object({
  paymentId: z.string().uuid(),
  merchantId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  targetCurrency: z.string().length(3),
  beneficiaryCountry: z.string().length(2),
});

export const createRuleSchema = z.object({
  name: z.string().min(3),
  priority: z.number().int().positive(),
  active: z.boolean().optional(),
  conditions: z.object({
    currency: z.string().length(3).optional(),
    targetCurrency: z.string().length(3).optional(),
    amountMin: z.number().positive().optional(),
    amountMax: z.number().positive().optional(),
    merchantId: z.string().uuid().optional(),
    beneficiaryCountry: z.string().length(2).optional(),
    timeWindowUTC: z
      .object({
        start: z.string().regex(/^\d{2}:\d{2}$/),
        end: z.string().regex(/^\d{2}:\d{2}$/),
      })
      .optional(),
  }),
  action: z.object({
    type: z.enum(['PREFER', 'EXCLUDE', 'FORCE']),
    pspName: z.string().min(2),
    boostScore: z.number().int().optional(),
  }),
});

export const updateRuleSchema = createRuleSchema.partial();
