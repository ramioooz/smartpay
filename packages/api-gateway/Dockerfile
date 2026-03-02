FROM node:20-alpine AS base
RUN npm install -g pnpm

WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api-gateway/package.json packages/api-gateway/

RUN pnpm install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY packages/api-gateway/ packages/api-gateway/

RUN pnpm --filter @smartpay/shared build
RUN pnpm --filter @smartpay/api-gateway build

FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/packages/shared/package.json ./packages/shared/
COPY --from=base /app/packages/api-gateway/dist ./packages/api-gateway/dist
COPY --from=base /app/packages/api-gateway/package.json ./packages/api-gateway/

WORKDIR /app/packages/api-gateway
ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "dist/index.js"]
