# SemCache

A microservice-based customer support system featuring semantic caching of Large Language Model (LLM) responses.

This project is developed as part of a master's thesis. The primary goal of the system is to reduce calls to external LLMs and lower response latency using semantic caching with an adaptive semantic similarity threshold that accounts for query category and local embedding cluster density.

---

## Monorepo Architecture

The project is organized as a monorepo powered by **pnpm Workspaces** and **Turborepo**:

```text
semcache/
├── apps/
│   ├── api-gateway/              # Single REST API entry point for clients
│   ├── auth-service/             # Authentication and user management service
│   ├── dialog-service/           # Dialog orchestration and conversation history service
│   ├── semantic-cache-service/   # Semantic caching service (pgvector, HNSW, adaptive threshold)
│   ├── llm-service/              # LLM provider integration and embedding generation service
│   ├── knowledge-base-service/   # Knowledge base and contextual search (RAG) service
│   └── frontend/                 # User web interface and analytics dashboard (React + Vite)
│
├── packages/
│   ├── shared-types/             # Shared domain TypeScript types and enums
│   ├── shared-dtos/              # Contracts and DTOs for HTTP gateway and TCP inter-service communication
│   ├── shared-config/            # Shared configuration utilities and port constants
│   └── eslint-config/            # Shared linter configurations (Oxlint)
│
├── infrastructure/
│   ├── docker/                   # Docker Compose PostgreSQL 17 + pgvector environment & .env.example
│   ├── postgres/                 # PostgreSQL + pgvector SQL initialization scripts
│   └── monitoring/               # Monitoring and metrics configurations
│
├── datasets/
│   ├── raw/                      # Raw customer support inquiry datasets
│   ├── processed/                # Cleaned and normalized datasets
│   └── labeled/                  # Labeled datasets with categories and clusters
│
├── tests/
│   ├── integration/              # Inter-service integration tests
│   ├── e2e/                      # End-to-end system tests
│   └── load/                     # Load tests and caching benchmarks
│
├── docs/                         # Technical and research documentation
│
├── pnpm-workspace.yaml           # pnpm Workspaces configuration
├── turbo.json                    # Turborepo build and verification pipelines
├── package.json                  # Root monorepo manifest and scripts
├── tsconfig.base.json            # Base TypeScript configuration
├── .oxlintrc.json                # Root Oxlint configuration
├── .gitignore                    # Git ignore rules
├── AGENTS.md                     # Architectural rules and guidelines for developers/agents
└── README.md                     # Project overview and setup instructions
```

---

## Applications (`apps/`)

| Application                | Package                            | Default Port | Purpose                                                                                                                                                      |
| :------------------------- | :--------------------------------- | :----------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API Gateway**            | `@semcache/api-gateway`            |    `3000`    | Routes external HTTP/REST client requests to internal microservices over NestJS TCP (`Transport.TCP`).                                                       |
| **Auth Service**           | `@semcache/auth-service`           |    `3001`    | Manages user accounts, sessions, and access permissions.                                                                                                     |
| **Dialog Service**         | `@semcache/dialog-service`         |    `3002`    | Orchestrates client dialogs, persists message history, and coordinates query processing.                                                                     |
| **Semantic Cache Service** | `@semcache/semantic-cache-service` |    `3003`    | Searches semantically similar queries in PostgreSQL (`pgvector`, HNSW, Cosine distance), calculates local cluster density, and computes adaptive thresholds. |
| **LLM Service**            | `@semcache/llm-service`            |    `3004`    | Integrates with LLM providers to generate responses and embedding vectors.                                                                                   |
| **Knowledge Base Service** | `@semcache/knowledge-base-service` |    `3005`    | Manages support documentation and retrieves relevant context.                                                                                                |
| **Frontend**               | `@semcache/frontend`               |    `5173`    | Client web application built with React, TypeScript, and Vite.                                                                                               |

---

## Shared Packages (`packages/`)

- **`@semcache/shared-types`** — contains shared immutable enums (`ServiceName`, `QueryCategory`, `CacheHitStatus`), canonical TCP patterns (`SERVICE_TCP_PATTERNS`), and base interfaces for semantic evaluation metadata.
- **`@semcache/shared-dtos`** — contains exclusively data contracts (DTOs) and format-inference helpers (`inferKnowledgeDocumentFormat`) for HTTP API Gateway endpoints and TCP inter-service communication (`AuthTcpRequestDto`, `AuthTcpResponseDto`, `DialogTcpRequestDto`, `RpcErrorPayloadDto`), plus a backend-only `@semcache/shared-dtos/validation` subpath exporting `class-validator`/`class-transformer` DTO classes shared between `api-gateway` and internal microservices.
- **`@semcache/shared-config`** — contains helper functions for safely reading environment variables (`getRequiredEnv`, `getOptionalEnv`, `getNumericEnv`) and the default service port mapping.
- **`@semcache/eslint-config`** — contains shared static code analysis (**Oxlint**) configurations for base packages (`base.json`), NestJS services (`nestjs.json`), and the React application (`react.json`).

---

## Local Prerequisites

- **Node.js**: `>= 20.0.0` (v22 or v24 LTS recommended)
- **pnpm**: `>= 9.0.0` (v12+ installed)
- **Docker** and **Docker Compose** (for running PostgreSQL 17 with `pgvector`)

---

## Quick Start

### 1. Configure Environment Variables

Each application in `apps/` has its own local `.env` file (see `apps/*/.env.example`) and never reads the root directory. Docker Compose PostgreSQL configuration lives in `infrastructure/docker/.env`.

To keep shared microservice variables (such as `INTERNAL_SERVICE_SECRET`, `DATABASE_URL`, and TCP service hosts/ports) in sync without duplicating them across every service, put them in `packages/shared-config/.env.backend`. Each backend app loads its local `.env` first and falls back to `packages/shared-config/.env.backend`:

```bash
cp infrastructure/docker/.env.example infrastructure/docker/.env
cp packages/shared-config/.env.backend.example packages/shared-config/.env.backend
for app in apps/*; do cp "$app/.env.example" "$app/.env"; done
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Start PostgreSQL + pgvector

Start the database container in the background:

```bash
pnpm db:up
```

Check database status and logs:

```bash
docker compose -f infrastructure/docker/docker-compose.yml ps
pnpm db:logs
```

On first startup, `infrastructure/postgres/init.sql` runs automatically to enable `CREATE EXTENSION IF NOT EXISTS vector;`.

Stop the database:

```bash
pnpm db:down
```

### 4. Apply Database Migrations (`auth-service`, `dialog-service`, `semantic-cache-service`, & `knowledge-base-service`)

After starting PostgreSQL, apply the Drizzle ORM migrations for `auth-service`, `dialog-service`, `semantic-cache-service`, and `knowledge-base-service`:

```bash
pnpm --filter @semcache/auth-service db:migrate
pnpm --filter @semcache/dialog-service db:migrate
pnpm --filter @semcache/semantic-cache-service db:migrate
pnpm --filter @semcache/knowledge-base-service db:migrate
```

### 5. Configure Free OpenRouter Models

Set `OPENROUTER_API_KEY` in `apps/llm-service/.env` (copied from `apps/llm-service/.env.example`). Only free OpenRouter models (`openrouter/free` or `<provider>/<model>:free`) are permitted by default.

---

## Architecture & Domain Documentation

- Application design, telecom UX standards, and UI architecture (`shadcn/ui` + Radix UI + Tailwind CSS): [docs/app-design-and-standards.md](./docs/app-design-and-standards.md)
- Authentication, CSRF protection, rate limiting, RBAC policies, API Gateway identity headers, and React integration: [docs/authentication-and-authorization.md](./docs/authentication-and-authorization.md)
- OpenRouter chat integration (`@nestjs/ai`), LangGraph dialog orchestration (`@langchain/langgraph`), and free-model enforcement: [docs/chat-and-llm-architecture.md](./docs/chat-and-llm-architecture.md)
- Semantic cache (`pgvector`, HNSW, caching regimes, adaptive threshold, operator API, & KB invalidation): [docs/semantic-cache-architecture.md](./docs/semantic-cache-architecture.md)
- Benchmark dataset (2,000 labeled UK/EN telecom requests, KB invalidation scenarios) and the k6 load test comparing `no-cache` / `fixed` / `adaptive`: [tests/load/README.md](./tests/load/README.md)

---

## Development, Build, and Verification Commands

All primary commands are executed from the monorepo root via **Turborepo**:

| Command             | Description                                                                                     |
| :------------------ | :---------------------------------------------------------------------------------------------- |
| `pnpm build`        | Builds all shared packages and applications respecting the dependency graph.                    |
| `pnpm dev`          | Starts all services and the frontend in parallel in development (`watch`) mode.                 |
| `pnpm lint`         | Runs static analysis across all packages and apps using **Oxlint** (`--type-aware` for NestJS). |
| `pnpm typecheck`    | Runs TypeScript type checking (`tsc --noEmit`) across the entire monorepo.                      |
| `pnpm test`         | Runs unit tests (Jest) across all packages and microservices.                                   |
| `pnpm test:e2e`     | Runs microservice end-to-end tests.                                                             |
| `pnpm format`       | Automatically formats repository files using **Prettier**.                                      |
| `pnpm format:check` | Verifies that all matched files conform to Prettier formatting rules.                           |

### Running a Single Application

To run a specific microservice or the frontend, use the `pnpm --filter` flag:

```bash
# Run only API Gateway in development mode
pnpm --filter @semcache/api-gateway dev

# Run only Semantic Cache Service
pnpm --filter @semcache/semantic-cache-service dev

# Run only Frontend
pnpm --filter @semcache/frontend dev
```
