# SmartPay — Global Payment Orchestration Platform

SmartPay orchestrates cross-border payment flows across multiple PSPs with routing, FX quoting, failover, event-driven reconciliation, and strict service-level data isolation.

## Overview

I built SmartPay to handle the messy parts of real payment infrastructure: provider outages, duplicate requests, stale FX quotes, settlement drift, and high-throughput traffic. My goal was to separate concerns into focused microservices with shared contracts and reliable event flows so the platform scales without coupling all business logic into one service.

The design is production-oriented even in local development: Kafka-driven async workflows, schema-per-service data ownership, PgBouncer-style pooling, Redis-backed idempotency, and API edge concerns handled independently from core payment orchestration.

## System Architecture

```text
                          ┌───────────────┐
                          │  API Gateway  │  (auth, rate-limit, request routing)
                          │  :3000        │
                          └──────┬────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
       ┌────────▼──────┐ ┌──────▼───────┐ ┌──────▼────────┐
       │  Payment Srv  │ │   FX Srv     │ │ Merchant Srv  │
       │  :3001        │ │   :3002      │ │ :3003         │
       └────────┬──────┘ └──────┬───────┘ └───────────────┘
                │                │
                ▼                ▼
       ┌─────────────────────────────────┐
       │         Kafka (Events)          │
       └───────────┬─────────────────────┘
                   │
          ┌────────┼────────┐
          │                 │
  ┌───────▼──────┐  ┌──────▼──────────────┐
  │ Routing Srv  │  │ Reconciliation Srv  │
  │ :3004        │  │ :3005               │
  └──────────────┘  └─────────────────────┘

Data Layer:
┌──────────────────────────────────────────────┐
│  PostgreSQL (:5432)                          │
│  └── PgBouncer (:6432) ← all services       │
│      ├── payments_schema   (payment-srv)     │
│      ├── merchants_schema  (merchant-srv)    │
│      └── routing_schema    (routing-srv)     │
├──────────────────────────────────────────────┤
│  MongoDB (:27017)                            │
│      ├── merchant configs  (merchant-srv)    │
│      ├── routing rules     (routing-srv)     │
│      ├── audit logs        (payment-srv)     │
│      └── recon reports     (reconciliation)  │
├──────────────────────────────────────────────┤
│  Redis (:6379)                               │
│      ├── FX rate cache     (fx-srv)          │
│      ├── idempotency keys  (payment-srv)     │
│      ├── rate limiting     (api-gateway)     │
│      └── circuit breaker   (payment-srv)     │
└──────────────────────────────────────────────┘
```

## Microservices

| Service | Port | Purpose | Data Ownership |
|---|---:|---|---|
| `api-gateway` | 3000 | External entrypoint, API key auth, rate limiting, request proxying | Redis rate-limit state |
| `payment-srv` | 3001 | Core payment orchestration and PSP execution | PostgreSQL `payments_schema`, Mongo audit logs, Redis idempotency/circuit keys |
| `fx-srv` | 3002 | FX rates, quote locking, spread application | Redis rate and quote cache |
| `merchant-srv` | 3003 | Merchant lifecycle, API keys, merchant config, webhook dispatch | PostgreSQL `merchants_schema`, Mongo merchant configs |
| `routing-srv` | 3004 | PSP scoring and routing decision engine | PostgreSQL `routing_schema`, Mongo routing rules |
| `reconciliation-srv` | 3005 | Settlement matching, discrepancy detection, reconciliation reporting | Mongo settled snapshots/reports/discrepancies, Redis dedupe |
| `shared` | n/a | Shared contracts, middleware, Kafka/DB helpers | n/a |

### How Services Interact

- Synchronous HTTP (request/response required):
  - API Gateway → Merchant Service (`verify-key`)
  - Payment Service → Routing Service (`/route`)
  - Payment Service → FX Service (`/rates/quote`)
- Asynchronous Kafka (event-driven fanout):
  - Payment Service emits `payment.*` lifecycle events
  - Routing Service consumes outcomes to update PSP health windows
  - Reconciliation Service consumes `payment.settled` and builds its own settlement view
  - Merchant Service consumes payment outcomes to drive webhooks
  - FX Service emits `fx.rate.updated` broadcasts

## Why This Architecture

- I chose service boundaries around business capabilities so each domain can scale independently.
- I use provider/adapter patterns so external integrations are swappable by configuration.
- I keep transactional money movement in PostgreSQL and flexible, high-write documents in MongoDB.
- I use Redis for low-latency coordination primitives: idempotency, throttling, and shared service state.
- I use Kafka to decouple downstream processing (reconciliation, webhook dispatch, health tracking) from synchronous payment latency.

## Local Development

### Prerequisites

- Docker + Docker Compose
- Node.js 20 LTS
- pnpm 9+

### Start the stack

```bash
cp .env.example .env
pnpm install

docker compose --profile app up -d --build
```

SmartPay edge endpoint (through Nginx):

- `http://localhost:3000`

### Useful health endpoints

- `http://localhost:3000/health` (gateway edge)
- `http://localhost:3001/health` (payment)
- `http://localhost:3002/health` (fx)
- `http://localhost:3003/health` (merchant)
- `http://localhost:3004/health` (routing)
- `http://localhost:3005/health` (reconciliation)

Kafka UI:

- `http://localhost:8080`

### Scale gateway replicas locally

```bash
docker compose --profile app up -d --scale api-gateway=3
```

Nginx load-balances across internal gateway containers, which mirrors how I would operate the edge tier in production.

## Example API Calls

Create merchant:

```bash
curl -X POST http://localhost:3000/api/v1/merchants \
  -H 'content-type: application/json' \
  -d '{"name":"TestCorp","email":"ops@testcorp.com"}'
```

Submit payment:

```bash
curl -X POST http://localhost:3000/api/v1/payments \
  -H 'content-type: application/json' \
  -H 'x-api-key: sk_test_smartpay_testcorp' \
  -d '{
    "merchantId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "externalRef":"inv-1001",
    "amount":1250.50,
    "currency":"USD",
    "targetCurrency":"AED",
    "beneficiary":{"name":"Ali Noor","country":"AE"}
  }'
```

Get FX quote:

```bash
curl -X POST http://localhost:3000/api/v1/rates/quote \
  -H 'content-type: application/json' \
  -d '{"pair":"USD-AED","sourceAmount":1000,"merchantId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890"}'
```

Run manual reconciliation:

```bash
curl -X POST http://localhost:3005/reconciliation/run \
  -H 'content-type: application/json' \
  -d '{}'
```

## Testing

SmartPay now includes a root Jest test harness with unit and integration boilerplate under `tests/`:

- `tests/unit/*` for deterministic service-level logic
- `tests/integration/*` for docker-backed end-to-end flows

Commands:

```bash
pnpm test       # package tests + root Jest suites
pnpm test:spec  # root Jest suites only
```

## Migration Path to AWS

| Local Component | AWS Target |
|---|---|
| Docker Compose services | ECS Fargate services (or EKS) |
| Nginx edge container | ALB + AWS API Gateway |
| PostgreSQL | Amazon RDS PostgreSQL |
| PgBouncer | Amazon RDS Proxy |
| MongoDB | Amazon DocumentDB (or managed MongoDB) |
| Redis | ElastiCache for Redis |
| Kafka | Amazon MSK |
| Local env vars | AWS Secrets Manager + SSM Parameter Store |

### Practical migration plan

1. Containerize each service image in ECR and deploy to ECS Fargate with one service per microservice.
2. Move Postgres to RDS and replace PgBouncer with RDS Proxy; keep per-service users/schema isolation unchanged.
3. Move Kafka topics to MSK and point `KAFKA_BROKERS` to broker endpoints.
4. Move Redis and Mongo workloads to managed AWS data stores.
5. Replace Nginx with ALB and optionally front with API Gateway for auth, quotas, and usage plans.
6. Add IAM roles, secret rotation, observability (CloudWatch + OpenTelemetry), and CI/CD deployment gates.

## Kubernetes Manifests

Kubernetes manifests for SmartPay live under `infra/k8s` and include:

- `namespace.yml` for `smartpay`
- one manifest per microservice (`api-gateway`, `payment-srv`, `fx-srv`, `merchant-srv`, `routing-srv`, `reconciliation-srv`)
- `pgbouncer.yml` with deployment/service and ConfigMap-backed config
- ingress for external traffic to `api-gateway`

The manifests are tuned for baseline production parity:

- 2 replicas per service
- health probes on `/health`
- resource limits (256Mi/250m for most services, 512Mi/500m for `payment-srv`)
- config provided via ConfigMaps

## Terraform (AWS)

AWS infrastructure definitions are available in `infra/terraform`:

- `main.tf` (provider, VPC module, baseline security groups)
- `variables.tf` (environment and sizing configuration)
- `ecs.tf` (ECS Fargate cluster, tasks, services, ALB)
- `rds.tf` (PostgreSQL RDS)
- `rds-proxy.tf` (RDS Proxy)
- `msk.tf` (Managed Kafka / MSK)
- `elasticache.tf` (Redis / ElastiCache)

## Current Status

SmartPay now has end-to-end service implementations for gateway, payment orchestration, FX, merchant management, routing, and reconciliation. The remaining production hardening work is focused on deeper test coverage, real PSP SDK integrations, and AWS deployment automation.
