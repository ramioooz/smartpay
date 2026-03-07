import { Request, Response } from 'express';
import { RoutingRequest } from '@smartpay/shared';
import { RoutingRuleDocument } from '../models/routing-rule.model';
import { routingEngine } from '../services/routing-engine';
import { pspHealthTracker } from '../services/psp-health-tracker';
import { ruleManager } from '../services/rule-manager';
import { createRuleSchema, routeSchema, updateRuleSchema } from '../validators/routing.validators';

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
    const patch = updateRuleSchema.parse(req.body) as Partial<RoutingRuleDocument>;
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
