# routing-srv
PSP routing decision service for SmartPay.

## Role in the System
This service selects the best PSP for each payment using weighted scoring and merchant/rule constraints. It tracks PSP health snapshots and exposes rule management endpoints for dynamic routing behavior. It does not execute payments; it only returns routing decisions.

## Data Stores
- PostgreSQL (`routing_schema.psp_health`) for health windows and latency/success metrics
- MongoDB (`routing_rules`) for dynamic rule definitions and priorities
- Redis for shared circuit state checks (`payment:circuit:*`)

## API Endpoints
| Method | Path | Description |
|---|---|---|
| POST | `/route` | Rank PSPs and return routing decision |
| GET | `/health/:pspName` | Get latest health metrics for one PSP |
| GET | `/rules` | List active routing rules |
| POST | `/rules` | Create routing rule |
| PUT | `/rules/:id` | Update routing rule |
| DELETE | `/rules/:id` | Deactivate routing rule |
| GET | `/health` | Service health |

## Kafka Events
Produces:
- none in this PR

Consumes:
- `payment.settled`, `payment.failed` to update rolling PSP health metrics in near-real-time

## Dependencies
Synchronous calls:
- none required for route decision API in current implementation

## Configuration
Required environment variables:
- `PORT`
- `ROUTING_DATABASE_URL`
- `MONGO_URI`
- `REDIS_HOST`
- `REDIS_PORT`
- `KAFKA_BROKERS`

Optional:
- `PAYMENT_SRV_URL`

## Running Standalone
```bash
pnpm --filter @smartpay/routing-srv db:generate
pnpm --filter @smartpay/routing-srv build
pnpm --filter @smartpay/routing-srv start
```

Run with PostgreSQL/PgBouncer, MongoDB, and Redis available.
