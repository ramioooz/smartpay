import { z } from 'zod';

export const runSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  pspName: z.string().min(1).optional(),
});

export const listReportsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const listDiscrepanciesSchema = z.object({
  pspName: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  severity: z.string().min(1).optional(),
  resolved: z
    .union([z.literal('true'), z.literal('false')])
    .transform((value: 'true' | 'false') => value === 'true')
    .optional(),
});

export const resolveDiscrepancySchema = z.object({
  note: z.string().trim().min(1).max(500).optional(),
});
