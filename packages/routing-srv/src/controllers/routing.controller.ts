import { Request, Response } from 'express';
import { z } from 'zod';
import { RoutingRequest } from '@smartpay/shared';
import { RoutingRuleDocument } from '../models/routing-rule.model';
import { routingEngine } from '../services/routing-engine';
import { pspHealthTracker } from '../services/psp-health-tracker';
import { ruleManager } from '../services/rule-manager';

const routeSchema = z.object({
  paymentId: z.string().uuid(),
  merchantId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  targetCurrency: z.string().length(3),
  beneficiaryCountry: z.string().length(2),
});

const createRuleSchema = z.object({
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

export class RoutingController {
  async route(req: Request, res: Response): Promise<void> {
    const input = routeSchema.parse(req.body) as RoutingRequest;
    const decision = await routingEngine.route(input);
    res.status(200).json(decision);
  }

  async getPspHealth(req: Request, res: Response): Promise<void> {
    const pspName = this.param(req, 'pspName');
    const health = await pspHealthTracker.getLatest(pspName);

    if (!health) {
      res.status(404).json({ error: `No health metrics found for PSP ${pspName}` });
      return;
    }

    res.status(200).json(health);
  }

  async listRules(_req: Request, res: Response): Promise<void> {
    const rules = await ruleManager.listActiveRules();
    res.status(200).json({ items: rules });
  }

  async createRule(req: Request, res: Response): Promise<void> {
    const payload = createRuleSchema.parse(req.body) as RoutingRuleDocument;
    const created = await ruleManager.createRule(payload);
    res.status(201).json(created);
  }

  async updateRule(req: Request, res: Response): Promise<void> {
    const id = this.param(req, 'id');
    const patch = createRuleSchema.partial().parse(req.body) as Partial<RoutingRuleDocument>;
    const updated = await ruleManager.updateRule(id, patch);

    if (!updated) {
      res.status(404).json({ error: `Routing rule ${id} was not found` });
      return;
    }

    res.status(200).json(updated);
  }

  async deactivateRule(req: Request, res: Response): Promise<void> {
    const id = this.param(req, 'id');
    const deactivated = await ruleManager.deactivateRule(id);

    if (!deactivated) {
      res.status(404).json({ error: `Routing rule ${id} was not found` });
      return;
    }

    res.status(204).send();
  }

  private param(req: Request, key: string): string {
    const value = req.params[key];
    return Array.isArray(value) ? value[0] : value;
  }
}

export const routingController = new RoutingController();
