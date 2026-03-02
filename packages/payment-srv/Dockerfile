FROM node:20-alpine AS base
RUN npm install -g pnpm

WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/payment-srv/package.json packages/payment-srv/

RUN pnpm install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY packages/payment-srv/ packages/payment-srv/

RUN pnpm --filter @smartpay/shared build
RUN pnpm --filter @smartpay/payment-srv build

FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/packages/shared/package.json ./packages/shared/
COPY --from=base /app/packages/payment-srv/dist ./packages/payment-srv/dist
COPY --from=base /app/packages/payment-srv/package.json ./packages/payment-srv/

WORKDIR /app/packages/payment-srv
ENV NODE_ENV=production

EXPOSE 3001
CMD ["node", "dist/index.js"]
