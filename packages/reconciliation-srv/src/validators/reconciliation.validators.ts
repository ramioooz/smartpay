import { z } from 'zod';

const requiredStringParam = (message: string) =>
  z.preprocess(
    (value) => {
      const normalized = Array.isArray(value) ? value[0] : value;
      return typeof normalized === 'string' ? normalized.trim() : '';
    },
    z.string().min(1, message),
  );

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

export const reportIdParamsSchema = z.object({
  id: requiredStringParam('Report id is required'),
});

export const discrepancyIdParamsSchema = z.object({
  id: requiredStringParam('Discrepancy id is required').superRefine((value, ctx) => {
    if (!/^[a-f0-9]{24}$/i.test(value)) {
      ctx.addIssue({
        code: 'custom',
        message: `Discrepancy id ${value} is not a valid Mongo ObjectId`,
      });
    }
  }),
});
