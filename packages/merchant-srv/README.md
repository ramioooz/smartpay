# Merchant Service (`merchant-srv`)

Manages merchant onboarding, merchant configuration, and API key lifecycle.

## Role in the system
This service is the source of truth for merchant identities and key status. It powers gateway authentication by exposing a key verification endpoint and stores flexible merchant routing/webhook preferences in MongoDB.

## Data stores
- PostgreSQL (`merchants_schema` via Prisma): `merchants`, `api_keys`
- MongoDB (`smartpay.merchant_configs`): PSP preferences, FX spread, webhook URLs, limits

## API endpoints
| Method | Path | Description |
|---|---|---|
| `POST` | `/merchants` | Create a merchant |
| `GET` | `/merchants/:id` | Get merchant details + API keys + config |
| `PUT` | `/merchants/:id` | Update merchant core profile/status |
| `POST` | `/merchants/:id/api-keys` | Generate a new API key pair and deprecate prior active keys |
| `DELETE` | `/merchants/:id/api-keys/:keyId` | Revoke API key immediately |
| `PUT` | `/merchants/:id/config` | Upsert merchant config in MongoDB |
| `POST` | `/merchants/:id/webhooks` | Register/update webhook URL for an event |
| `GET` | `/merchants/verify-key` | Verify `X-API-Key` for gateway auth |
| `GET` | `/health` | Health check with PostgreSQL and Mongo connectivity |

## Kafka events
- Produces: none yet (planned in next service increment)
- Consumes: `merchant.webhook.dispatch` (payment lifecycle webhook dispatch requests from `payment-srv`)

## Dependencies
- `@smartpay/shared` for middleware/logger/helpers
- PostgreSQL (via PgBouncer) and MongoDB
- No synchronous service-to-service calls yet in this PR

## Configuration
Required env vars:
- `PORT`
- `MERCHANT_DATABASE_URL`
- `MONGO_URI`
- `KAFKA_BROKERS`
- `WEBHOOK_HMAC_SALT`

## Running standalone
1. Ensure PostgreSQL (with `merchants_schema`) and MongoDB are running.
2. Generate Prisma client:
   - `pnpm --filter @smartpay/merchant-srv db:generate`
3. Start the service build:
   - `pnpm --filter @smartpay/merchant-srv build`
   - `node packages/merchant-srv/dist/index.js`
