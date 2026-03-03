# fx-srv
Foreign exchange rate and quote service for SmartPay.

## Role in the System
This service provides real-time FX rates and short-lived conversion quotes used during payment orchestration. It uses a provider/adapter pattern with automatic failover between live Frankfurter rates and a simulated fallback. It also publishes rate updates to Kafka for downstream consumers.

## Data Stores
- Redis for rate cache (`fx:rates:*`) and short-lived quotes (`fx:quotes:*`)

## API Endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/rates/:pair` | Get latest FX rate for a currency pair |
| POST | `/rates/quote` | Create a locked quote with conversion |
| DELETE | `/rates/quote/:quoteId` | Release/delete a locked quote reservation |
| GET | `/rates/pairs` | List supported currency pairs |
| GET | `/health` | Service health and active provider |

## Kafka Events
Produces:
- `fx.rate.updated`

Consumes:
- None

## Dependencies
Synchronous calls:
- Frankfurter API (`https://api.frankfurter.dev/v1/latest`) as primary provider

## Configuration
Required environment variables:
- `PORT`
- `REDIS_HOST`
- `REDIS_PORT`
- `KAFKA_BROKERS`
- `FX_PRIMARY_PROVIDER`
- `FX_FALLBACK_PROVIDER`
- `FRANKFURTER_BASE_URL`
- `FX_RATE_REFRESH_INTERVAL_MS`
- `FX_RATE_CACHE_TTL_SECONDS`

## Running Standalone
```bash
pnpm --filter @smartpay/fx-srv build
pnpm --filter @smartpay/fx-srv start
```

For full behavior, run with Redis + Kafka available (Docker Compose recommended).
