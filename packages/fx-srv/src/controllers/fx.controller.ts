import { Request, Response } from 'express';
import { z } from 'zod';
import { createQuote, getLatestRate, listSupportedPairs, releaseQuote } from '../services/fx.service';

const pairParamsSchema = z.object({
  pair: z.string().min(7),
});

const quoteBodySchema = z.object({
  pair: z.string().min(7),
  sourceAmount: z.number().positive(),
  merchantId: z.string().uuid(),
  merchantSpreadBps: z.number().int().positive().max(500).optional(),
});

const quoteParamsSchema = z.object({
  quoteId: z.string().min(1),
});

export class FxController {
  async getRate(req: Request, res: Response): Promise<void> {
    const { pair } = pairParamsSchema.parse(req.params);
    const rate = await getLatestRate(pair);
    res.status(200).json(rate);
  }

  async getPairs(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ pairs: listSupportedPairs() });
  }

  async createQuote(req: Request, res: Response): Promise<void> {
    const body = quoteBodySchema.parse(req.body);
    const quote = await createQuote(body);
    res.status(201).json(quote);
  }

  async releaseQuote(req: Request, res: Response): Promise<void> {
    const { quoteId } = quoteParamsSchema.parse(req.params);
    const result = await releaseQuote(quoteId);
    res.status(200).json(result);
  }
}

export const fxController = new FxController();
