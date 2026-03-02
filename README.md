# SmartPay

Local development now uses Nginx as the edge entrypoint in front of `api-gateway`.

Current implementation includes:
- shared package foundation (types, middleware, Kafka/db helpers, utilities)
- merchant service core APIs
- API gateway auth/rate-limiting/proxy layer
- payment service core orchestration with adapter registry, idempotency lock, and health checks

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
