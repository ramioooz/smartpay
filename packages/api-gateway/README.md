# API Gateway (`api-gateway`)

Single entry point for SmartPay client traffic.

## Role in the system
This service handles API-key authentication, per-key rate limiting, and request routing to downstream domain services. It keeps business logic out of the edge layer and centralizes operational controls like request correlation, structured logging, and health aggregation.

## Data stores
- Redis: sliding-window rate limiting state (`gateway:ratelimit:{apiKey}`)
- No direct SQL or Mongo ownership in this service

## API endpoints
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/payments` | Proxy to `payment-srv` create payment |
| `GET` | `/api/v1/payments/:id` | Proxy to `payment-srv` payment status |
| `POST` | `/api/v1/payments/:id/refund` | Proxy to `payment-srv` refund initiation |
| `GET` | `/api/v1/rates/:pair` | Proxy to `fx-srv` pair rate |
| `POST` | `/api/v1/rates/quote` | Proxy to `fx-srv` locked quote |
| `GET` | `/api/v1/rates/pairs` | Proxy to `fx-srv` supported pairs |
| `POST` | `/api/v1/merchants` | Proxy to `merchant-srv` create merchant |
| `GET` | `/api/v1/merchants/:id` | Proxy to `merchant-srv` merchant details |
| `PUT` | `/api/v1/merchants/:id` | Proxy to `merchant-srv` update merchant |
| `POST` | `/api/v1/merchants/:id/api-keys` | Proxy to `merchant-srv` key generation |
| `GET` | `/health` | Gateway + downstream health aggregate |

## Kafka events
- Produces: none
- Consumes: none

## Dependencies
- `merchant-srv` for API key verification (`GET /merchants/verify-key`)
- `payment-srv` and `fx-srv` for routed business requests
- Redis for distributed rate-limit counters

## Configuration
Required env vars:
- `PORT`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` (optional)
- `MERCHANT_SRV_URL`, `PAYMENT_SRV_URL`, `FX_SRV_URL`
- `GATEWAY_RATE_LIMIT_PER_MINUTE`
- `GATEWAY_REQUEST_TIMEOUT_MS`
- `CORS_ORIGINS`

## Running standalone
1. Start Redis and downstream services.
2. Build gateway:
   - `pnpm --filter @smartpay/api-gateway build`
3. Run:
   - `node packages/api-gateway/dist/index.js`
