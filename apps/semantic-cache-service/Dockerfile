# syntax=docker/dockerfile:1.7
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@12.18.0 --activate

FROM base AS builder
WORKDIR /workspace
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/semantic-cache-service/ ./apps/semantic-cache-service/
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter @semcache/semantic-cache-service... build
RUN pnpm --filter @semcache/semantic-cache-service deploy --prod --legacy /prod

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV SEMANTIC_CACHE_SERVICE_HOST=0.0.0.0
ENV SEMANTIC_CACHE_SERVICE_PORT=3003
ENV METRICS_HOST=0.0.0.0
ENV METRICS_PORT=9103
COPY --from=builder --chown=node:node /prod /app
USER node
EXPOSE 3003 9103
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:9103/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
