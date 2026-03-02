FROM node:20-alpine AS base
RUN npm install -g pnpm

WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/merchant-srv/package.json packages/merchant-srv/

RUN pnpm install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY packages/merchant-srv/ packages/merchant-srv/

RUN pnpm --filter @smartpay/merchant-srv db:generate
RUN pnpm --filter @smartpay/shared build
RUN pnpm --filter @smartpay/merchant-srv build

FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/packages/shared/package.json ./packages/shared/
COPY --from=base /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=base /app/packages/merchant-srv/dist ./packages/merchant-srv/dist
COPY --from=base /app/packages/merchant-srv/node_modules ./packages/merchant-srv/node_modules

RUN mkdir -p /app/node_modules/@smartpay && ln -sfn /app/packages/shared /app/node_modules/@smartpay/shared

WORKDIR /app/packages/merchant-srv
ENV NODE_ENV=production

EXPOSE 3003
CMD ["node", "dist/index.js"]
