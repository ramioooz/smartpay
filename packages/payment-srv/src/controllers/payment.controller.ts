import { Request, Response } from 'express';
import { RequestWithId } from '@smartpay/shared';
import { z } from 'zod';
import { paymentOrchestrator } from '../services/orchestrator';

const createPaymentSchema = z.object({
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

const paymentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const refundSchema = z.object({
  amount: z.number().positive(),
});

export class PaymentController {
  async createPayment(req: Request, res: Response): Promise<void> {
    const input = createPaymentSchema.parse(req.body);
    const correlationId = (req as RequestWithId).requestId ?? 'payment-create';

    const result = await paymentOrchestrator.createPayment(input, correlationId);
    res.status(result.status === 'FAILED' ? 202 : 201).json(result);
  }

  async getPayment(req: Request, res: Response): Promise<void> {
    const { id } = paymentIdParamsSchema.parse(req.params);
    const payment = await paymentOrchestrator.getPaymentById(id);

    if (!payment) {
      res.status(404).json({ error: `Payment ${id} was not found` });
      return;
    }

    res.status(200).json(payment);
  }

  async initiateRefund(req: Request, res: Response): Promise<void> {
    const { id } = paymentIdParamsSchema.parse(req.params);
    const { amount } = refundSchema.parse(req.body);
    const correlationId = (req as RequestWithId).requestId ?? 'payment-refund';

    const result = await paymentOrchestrator.initiateRefund(id, amount, correlationId);
    res.status(202).json(result);
  }
}

export const paymentController = new PaymentController();
