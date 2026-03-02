import { Document, ObjectId } from 'mongodb';
import { RoutingRequest, createLogger } from '@smartpay/shared';
import { RoutingRuleDocument } from '../models/routing-rule.model';
import { getMongoClient } from './mongo';

const logger = createLogger({ service: 'routing-srv', component: 'rule-manager' });

type RuleMatchResult = {
  excludes: Set<string>;
  force?: string;
  boosts: Map<string, number>;
};

export class RuleManager {
  async listActiveRules(): Promise<RoutingRuleDocument[]> {
    const mongo = await getMongoClient();
    return mongo
      .db('smartpay')
      .collection<RoutingRuleDocument>('routing_rules')
      .find({ active: true })
      .sort({ priority: 1 })
      .toArray();
  }

  async createRule(rule: RoutingRuleDocument): Promise<RoutingRuleDocument> {
    const mongo = await getMongoClient();
    const payload = {
      ...rule,
      _id: undefined,
      active: rule.active ?? true,
    };

    const result = await mongo
      .db('smartpay')
      .collection<Document>('routing_rules')
      .insertOne(payload as Document);
    return {
      ...payload,
      _id: String(result.insertedId),
    };
  }

  async updateRule(id: string, patch: Partial<RoutingRuleDocument>): Promise<RoutingRuleDocument | null> {
    const mongo = await getMongoClient();
    const objectId = new ObjectId(id);

    const updated = await mongo
      .db('smartpay')
      .collection<Document>('routing_rules')
      .findOneAndUpdate({ _id: objectId }, { $set: patch }, { returnDocument: 'after' });

    return updated as RoutingRuleDocument | null;
  }

  async deactivateRule(id: string): Promise<boolean> {
    const mongo = await getMongoClient();
    const objectId = new ObjectId(id);

    const result = await mongo
      .db('smartpay')
      .collection('routing_rules')
      .updateOne({ _id: objectId }, { $set: { active: false } });

    return result.modifiedCount > 0;
  }

  evaluateRules(request: RoutingRequest, rules: RoutingRuleDocument[]): RuleMatchResult {
    const result: RuleMatchResult = {
      excludes: new Set<string>(),
      boosts: new Map<string, number>(),
    };

    for (const rule of rules) {
      if (!rule.active || !this.matchesRequest(request, rule)) {
        continue;
      }

      if (rule.action.type === 'FORCE') {
        result.force = rule.action.pspName;
        continue;
      }

      if (rule.action.type === 'EXCLUDE') {
        result.excludes.add(rule.action.pspName);
        continue;
      }

      const previous = result.boosts.get(rule.action.pspName) ?? 0;
      result.boosts.set(rule.action.pspName, previous + (rule.action.boostScore ?? 0));
    }

    return result;
  }

  private matchesRequest(request: RoutingRequest, rule: RoutingRuleDocument): boolean {
    const conditions = rule.conditions;
    if (conditions.currency && conditions.currency !== request.currency) return false;
    if (conditions.targetCurrency && conditions.targetCurrency !== request.targetCurrency) return false;
    if (conditions.beneficiaryCountry && conditions.beneficiaryCountry !== request.beneficiaryCountry) {
      return false;
    }
    if (conditions.merchantId && conditions.merchantId !== request.merchantId) return false;
    if (conditions.amountMin !== undefined && request.amount < conditions.amountMin) return false;
    if (conditions.amountMax !== undefined && request.amount > conditions.amountMax) return false;

    if (conditions.timeWindowUTC && !this.isWithinWindow(conditions.timeWindowUTC)) {
      return false;
    }

    return true;
  }

  private isWithinWindow(window: { start: string; end: string }): boolean {
    try {
      const now = new Date();
      const [startHour, startMinute] = window.start.split(':').map(Number);
      const [endHour, endMinute] = window.end.split(':').map(Number);
      const minutesNow = now.getUTCHours() * 60 + now.getUTCMinutes();
      const minutesStart = startHour * 60 + startMinute;
      const minutesEnd = endHour * 60 + endMinute;

      if (minutesStart <= minutesEnd) {
        return minutesNow >= minutesStart && minutesNow <= minutesEnd;
      }

      return minutesNow >= minutesStart || minutesNow <= minutesEnd;
    } catch (error) {
      logger.warn({ error, window }, 'Invalid rule time window, skipping condition');
      return true;
    }
  }
}

export const ruleManager = new RuleManager();
