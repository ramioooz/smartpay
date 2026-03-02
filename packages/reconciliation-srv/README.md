# Reconciliation Service (`@smartpay/reconciliation-srv`)

Batch and on-demand reconciliation service that compares internal settled payments with PSP settlement records.

## Role in the system

This service keeps the financial truth aligned by validating that SmartPay settlement records match provider-side data. It consumes `payment.settled` events, builds its own local settlement dataset, and then runs matching jobs that detect and classify drift. It does not read payment-srv PostgreSQL schemas directly.

## Data stores

- MongoDB (`smartpay`): owns `settled_payments`, `reconciliation_reports`, and `discrepancies`
- Redis: Kafka consumer dedupe keys (`recon:consumed:*`)
- Kafka: consumes `payment.settled`; produces reconciliation completion and discrepancy events

## API endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/reconciliation/run` | Trigger manual reconciliation for a time window |
| GET | `/reconciliation/reports` | List reports (paginated) |
| GET | `/reconciliation/reports/:id` | Get report details with discrepancy items |
| GET | `/reconciliation/discrepancies` | List discrepancies with filters |
| PUT | `/reconciliation/discrepancies/:id` | Mark discrepancy as resolved |
| GET | `/health` | Service health (Mongo + Redis) |

## Kafka events

- Consumes:
  - `payment.settled`
- Produces:
  - `reconciliation.completed`
  - `reconciliation.discrepancy.detected`

## Dependencies

- No synchronous calls to other services in the current implementation
- Uses shared Kafka topics/contracts from `@smartpay/shared`

## Configuration

Required environment variables:

- `PORT`
- `MONGO_URI`
- `REDIS_HOST`
- `REDIS_PORT`
- `KAFKA_BROKERS`
- `RECON_HOURLY_CRON` (default: `0 * * * *`)
- `RECON_DAILY_CRON` (default: `30 0 * * *`)
- `RECON_DEFAULT_LOOKBACK_MINUTES` (default: `60`)

## Running standalone

```bash
pnpm --filter @smartpay/reconciliation-srv build
pnpm --filter @smartpay/reconciliation-srv start
```

If running outside Docker Compose, provide reachable MongoDB, Redis, and Kafka endpoints via env vars.
