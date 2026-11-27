# syntax=docker/dockerfile:1.7
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@12.18.0 --activate

FROM base AS builder
WORKDIR /workspace
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/auth-service/ ./apps/auth-service/
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter @semcache/auth-service... build
RUN pnpm --filter @semcache/auth-service deploy --prod --legacy /prod

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV AUTH_SERVICE_HOST=0.0.0.0
ENV AUTH_SERVICE_PORT=3001
ENV METRICS_HOST=0.0.0.0
ENV METRICS_PORT=9101
COPY --from=builder --chown=node:node /prod /app
USER node
EXPOSE 3001 9101
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:9101/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
