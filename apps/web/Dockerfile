FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY packages/config/package.json packages/config/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --filter @eventhub/web --frozen-lockfile=false

FROM deps AS build
COPY packages packages
COPY apps/web apps/web
WORKDIR /app/apps/web
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/web/node_modules /app/apps/web/node_modules
COPY --from=build /app/apps/web/.next /app/apps/web/.next
COPY --from=build /app/apps/web/public /app/apps/web/public
COPY --from=build /app/apps/web/standalone /app/apps/web/standalone
COPY --from=build /app/apps/web/package.json /app/apps/web/package.json
WORKDIR /app/apps/web
EXPOSE 3000
USER nextjs
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1
CMD ["pnpm", "start"]
