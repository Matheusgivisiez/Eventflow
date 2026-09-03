FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && \
    apk add --no-cache openssl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN pnpm prisma:generate && pnpm build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3001
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/apps/api/prisma /app/apps/api/prisma
WORKDIR /app/apps/api
EXPOSE 3001
USER nestjs
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider "http://localhost:${PORT:-3001}/api/health" || exit 1
CMD ["sh", "-c", "./node_modules/.bin/prisma db push && node dist/main.js"]
