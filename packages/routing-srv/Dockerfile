FROM node:20-alpine AS base
RUN npm install -g pnpm

WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/routing-srv/package.json packages/routing-srv/

RUN pnpm install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY packages/routing-srv/ packages/routing-srv/

RUN pnpm --filter @smartpay/shared build
RUN pnpm --filter @smartpay/routing-srv build

FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/packages/shared/package.json ./packages/shared/
COPY --from=base /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=base /app/packages/routing-srv/dist ./packages/routing-srv/dist
COPY --from=base /app/packages/routing-srv/node_modules ./packages/routing-srv/node_modules

RUN mkdir -p /app/node_modules/@smartpay && ln -sfn /app/packages/shared /app/node_modules/@smartpay/shared

WORKDIR /app/packages/routing-srv
ENV NODE_ENV=production

EXPOSE 3004
CMD ["node", "dist/index.js"]
