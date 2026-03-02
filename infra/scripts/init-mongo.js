db = db.getSiblingDB('smartpay');

db.createCollection('merchant_configs');
db.merchant_configs.createIndex({ merchantId: 1 }, { unique: true });

db.createCollection('routing_rules');
db.routing_rules.createIndex({ priority: 1 });

db.createCollection('transaction_logs');
db.transaction_logs.createIndex({ paymentId: 1 });
db.transaction_logs.createIndex({ timestamp: -1 });
db.transaction_logs.createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

db.createCollection('reconciliation_reports');
db.reconciliation_reports.createIndex({ createdAt: -1 });
db.reconciliation_reports.createIndex({ pspName: 1, periodStart: -1 });
db.reconciliation_reports.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

db.createCollection('discrepancies');
db.discrepancies.createIndex({ reportId: 1 });
db.discrepancies.createIndex({ pspName: 1, resolved: 1 });

db.createCollection('settled_payments');
db.settled_payments.createIndex({ pspTransactionId: 1 }, { unique: true });

db.routing_rules.insertMany([
  {
    name: 'Large AED transfers prefer crypto rail',
    priority: 1,
    active: true,
    conditions: {
      targetCurrency: 'AED',
      amountMin: 10000,
    },
    action: {
      type: 'PREFER',
      pspName: 'crypto-rail',
      boostScore: 20,
    },
  },
  {
    name: 'Small USD payments use Stripe',
    priority: 2,
    active: true,
    conditions: {
      currency: 'USD',
      amountMax: 1000,
    },
    action: {
      type: 'PREFER',
      pspName: 'stripe',
      boostScore: 15,
    },
  },
  {
    name: 'MENA region prefer Checkout.com',
    priority: 3,
    active: true,
    conditions: {
      beneficiaryCountry: 'AE',
    },
    action: {
      type: 'PREFER',
      pspName: 'checkout',
      boostScore: 10,
    },
  },
]);
