export const TOPICS = {
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_ROUTED: 'payment.routed',
  PAYMENT_SUBMITTED: 'payment.submitted',
  PAYMENT_SETTLED: 'payment.settled',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',
  FX_RATE_UPDATED: 'fx.rate.updated',
  ROUTING_REQUESTED: 'routing.requested',
  ROUTING_DECISION: 'routing.decision',
  RECONCILIATION_COMPLETED: 'reconciliation.completed',
  RECONCILIATION_DISCREPANCY: 'reconciliation.discrepancy.detected',
  MERCHANT_WEBHOOK: 'merchant.webhook.dispatch',
} as const;

export type KafkaTopic = (typeof TOPICS)[keyof typeof TOPICS];
