# SmartPay

Local development now uses Nginx as the edge entrypoint in front of `api-gateway`.

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
