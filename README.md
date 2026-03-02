# SmartPay

Local development now uses Nginx as the edge entrypoint in front of `api-gateway`.

Current implementation includes:
- shared package foundation (types, middleware, Kafka/db helpers, utilities)
- merchant service core APIs
- API gateway auth/rate-limiting/proxy layer
- payment service core orchestration with adapter registry, idempotency lock, and health checks
- FX service core with Frankfurter primary provider, simulated fallback provider, Redis quote cache, and Kafka rate publishing
- routing service core with weighted PSP scoring, rule management APIs, and PSP health persistence

## Local Run

```bash
docker compose --profile app up -d --build
```

Access SmartPay through Nginx:

- `http://localhost:${NGINX_PORT:-3000}`

`api-gateway` is internal-only in Docker Compose, which allows horizontal scaling without host-port conflicts.

## Scale API Gateway

```bash
docker compose --profile app up -d --scale api-gateway=3
```

Nginx load-balances requests to gateway replicas over the internal Docker network.

## Payment Service Setup

The payment service now uses Prisma with `payments_schema`. Generate the client and apply schema before testing payment flows:

```bash
pnpm --filter @smartpay/payment-srv db:generate
PAYMENT_DATABASE_URL='postgresql://payment_srv_user:payment_srv_password@localhost:6432/smartpay?schema=payments_schema&pgbouncer=true' \
pnpm --filter @smartpay/payment-srv exec prisma db push --schema prisma/schema.prisma
```

## FX Service Smoke Test

With compose running, you can test FX APIs directly:

```bash
curl http://localhost:3002/health
curl http://localhost:3002/rates/USD-EUR
curl -X POST http://localhost:3002/rates/quote \
  -H 'content-type: application/json' \
  -d '{"pair":"USD-EUR","sourceAmount":1000,"merchantId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890"}'
```
