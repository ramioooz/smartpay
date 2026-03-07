import { z } from 'zod';

export const pairParamsSchema = z.object({
  pair: z.string().min(7),
});

export const quoteBodySchema = z.object({
  pair: z.string().min(7),
  sourceAmount: z.number().positive(),
  merchantId: z.string().uuid(),
  merchantSpreadBps: z.number().int().positive().max(500).optional(),
});

export const quoteParamsSchema = z.object({
  quoteId: z.string().min(1),
});
