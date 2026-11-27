# syntax=docker/dockerfile:1.7
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@12.18.0 --activate

FROM base AS builder
WORKDIR /workspace
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/embedding-service/ ./apps/embedding-service/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @semcache/embedding-service... build
RUN pnpm --filter @semcache/embedding-service deploy --prod --legacy /prod

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV EMBEDDING_SERVICE_HOST=0.0.0.0
ENV EMBEDDING_SERVICE_PORT=3006
ENV METRICS_HOST=0.0.0.0
ENV METRICS_PORT=9106
ENV HF_HOME=/app/.cache/huggingface
RUN mkdir -p /app/.cache/huggingface && chown -R node:node /app/.cache/huggingface
COPY --from=builder --chown=node:node /prod /app
USER node
EXPOSE 3006 9106
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:9106/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
