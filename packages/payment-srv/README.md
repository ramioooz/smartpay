# payment-srv
Core payment orchestration service for SmartPay.

## Role in the System
This service owns the payment lifecycle from initiation to settlement or failure. It selects PSP adapters, applies FX quotes, writes transactional state, and publishes payment domain events. It is the stateful orchestration layer behind `/payments` APIs.

## Data Stores
- PostgreSQL (`payments_schema`) for payments and ledger entries via Prisma
- MongoDB (`transaction_logs`) for audit trail entries
- Redis for idempotency locks and circuit breaker state

## API Endpoints
| Method | Path | Description |
|---|---|---|
| POST | `/payments` | Create and orchestrate a new payment |
| GET | `/payments/:id` | Fetch current payment status and details |
| POST | `/payments/:id/refund` | Initiate a refund through the selected PSP |
| GET | `/health` | Service health with DB/cache/adapter checks |

## Kafka Events
Produces:
- `payment.created`
- `payment.settled`
- `payment.failed`
- `merchant.webhook.dispatch`

Consumes:
- `routing.decision` (placeholder consumer wired, full flow pending)

## Dependencies
Synchronous calls:
- `routing-srv` (`POST /route`) for ranked PSP decisions
- `fx-srv` (`POST /rates/quote`) for FX quote retrieval

## Configuration
Required environment variables:
- `PORT`
- `PAYMENT_DATABASE_URL`
- `MONGO_URI`
- `REDIS_HOST`
- `REDIS_PORT`
- `KAFKA_BROKERS`
- `ROUTING_SRV_URL`
- `FX_SRV_URL`

Optional:
- `IDEMPOTENCY_LOCK_TTL_SECONDS`

## Running Standalone
```bash
pnpm --filter @smartpay/payment-srv db:generate
pnpm --filter @smartpay/payment-srv build
pnpm --filter @smartpay/payment-srv start
```

For local integration, run with Docker Compose so PostgreSQL/PgBouncer, MongoDB, Redis, and Kafka are available.
