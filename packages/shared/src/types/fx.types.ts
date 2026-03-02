export interface FXRate {
  pair: string;
  bid: number;
  ask: number;
  mid: number;
  timestamp: Date;
  source: string;
}

export interface FXQuote {
  quoteId: string;
  pair: string;
  rate: number;
  spread: number;
  sourceAmount: number;
  targetAmount: number;
  expiresAt: Date;
}
