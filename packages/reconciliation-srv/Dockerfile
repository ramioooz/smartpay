FROM node:20-alpine AS base
RUN npm install -g pnpm

WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/reconciliation-srv/package.json packages/reconciliation-srv/

RUN pnpm install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY packages/reconciliation-srv/ packages/reconciliation-srv/

RUN pnpm --filter @smartpay/shared build
RUN pnpm --filter @smartpay/reconciliation-srv build

FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/packages/shared/package.json ./packages/shared/
COPY --from=base /app/packages/reconciliation-srv/dist ./packages/reconciliation-srv/dist
COPY --from=base /app/packages/reconciliation-srv/package.json ./packages/reconciliation-srv/

WORKDIR /app/packages/reconciliation-srv
ENV NODE_ENV=production

EXPOSE 3005
CMD ["node", "dist/index.js"]
