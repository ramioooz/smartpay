export type RoutingRuleActionType = 'PREFER' | 'EXCLUDE' | 'FORCE';

export interface RoutingRule {
  name: string;
  priority: number;
  active: boolean;
  conditions: {
    currency?: string;
    targetCurrency?: string;
    amountMin?: number;
    amountMax?: number;
    merchantId?: string;
    beneficiaryCountry?: string;
    timeWindowUTC?: { start: string; end: string };
  };
  action: {
    type: RoutingRuleActionType;
    pspName: string;
    boostScore?: number;
  };
}

export interface RoutingRuleDocument extends RoutingRule {
  _id?: unknown;
}
