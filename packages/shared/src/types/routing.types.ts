export interface RoutingRequest {
  paymentId: string;
  merchantId: string;
  amount: number;
  currency: string;
  targetCurrency: string;
  beneficiaryCountry: string;
}

export interface PSPScore {
  pspName: string;
  score: number;
  factors: {
    costScore: number;
    latencyScore: number;
    successRateScore: number;
    currencySupport: boolean;
    countrySupport: boolean;
  };
}

export interface RoutingDecision {
  paymentId: string;
  rankedPSPs: PSPScore[];
  selectedPSP: string;
  reason: string;
}
