# AGENTS.md — SemCache Architectural Rules and Development Standards

This document defines mandatory architectural principles, constraints, and code quality standards for all developers and AI agents working in the **SemCache** monorepo.

---

## 1. System Architecture Rules

1. **Microservice Isolation**:
   - Every backend service in `apps/` (`api-gateway`, `auth-service`, `dialog-service`, `semantic-cache-service`, `llm-service`, `knowledge-base-service`) is an **independent NestJS application** with its own entry point, configuration, and lifecycle.
2. **Single Responsibility**:
   - `api-gateway` — strictly external request routing, input validation, and response aggregation.
   - `auth-service` — authentication, authorization, and user profile management.
   - `dialog-service` — dialog session management, message history persistence, and client request flow orchestration.
   - `semantic-cache-service` — storing and retrieving cached responses by embedding vectors, computing local cluster density, and calculating adaptive similarity thresholds.
   - `llm-service` — LLM provider integration, response generation, and embedding vector generation.
   - `knowledge-base-service` — managing knowledge base articles/documents and vector context retrieval.
3. **Inter-Service Communication**:
   - External client communication with `api-gateway` uses HTTP/REST (`http://localhost:3000`).
   - Communication between internal microservices (`auth-service`, `dialog-service`, `semantic-cache-service`, `llm-service`, `knowledge-base-service`) and from `api-gateway` to internal microservices happens **exclusively synchronously via NestJS TCP transport** (`@nestjs/microservices`, `Transport.TCP`) using canonical message patterns (`SERVICE_TCP_PATTERNS`).
   - **Prohibited**: adding message brokers (RabbitMQ, Kafka, Redis Pub/Sub, etc.) unless explicitly approved by an architecture change.

---

## 2. Database and Data Rules

1. **Table and Migration Isolation**:
   - Initially, all services may share a single physical PostgreSQL 17 instance (with the `pgvector` extension), yet **each microservice owns exclusively its own tables and migrations**.
2. **Strict Prohibition of Direct Cross-Service Table Access**:
   - **STRICTLY PROHIBITED**: one microservice executing SQL queries (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `JOIN`) against the internal tables of another microservice.
   - All data belonging to another domain must be requested exclusively through the TCP microservice API (`@MessagePattern` / `SERVICE_TCP_PATTERNS`) of the owning microservice.
3. **ORM Usage**:
   - **Drizzle ORM** and **Drizzle Kit** are used for database operations.
   - **Prohibited**: creating a single shared database schema package (`shared-db` or similar) in `packages/`. Table schemas (`schema.ts`) and migration configurations (`drizzle.config.ts`) must reside inside each respective microservice.
4. **Vector Search**:
   - Vector columns and similarity operations (`pgvector`, HNSW indexes, Cosine distance `<=>`) are encapsulated inside their respective services (`semantic-cache-service`, `knowledge-base-service`).

---

## 3. Shared Packages (`packages/`) Rules

1. **Minimalism and Zero Business Logic**:
   - Packages in `packages/` (`@semcache/shared-types`, `@semcache/shared-dtos`, `@semcache/shared-config`, `@semcache/eslint-config`) exist **strictly** to avoid duplicating types, communication contracts, and technical configuration.
   - **Prohibited**: moving business logic, NestJS services, repositories, or threshold calculation algorithms into shared packages.
2. **Contracts and API Change Documentation**:
   - Any change to inter-service DTOs in `@semcache/shared-dtos` or shared types in `@semcache/shared-types` is considered an API contract change.
   - **Mandatory requirement**: every API contract change must be accompanied by updating the corresponding types in `@semcache/shared-dtos`, verifying compatibility across all consumers (`pnpm typecheck` and `pnpm build`), and documenting the change in `docs/` or `README.md`.

---

## 4. TypeScript Code and Quality Rules

1. **Strict Typing**:
   - All packages and services extend `tsconfig.base.json` with `strict: true`, `noImplicitAny: true`, and `strictNullChecks: true` enabled.
   - Avoid using `any`. Use concrete types, generics, or `unknown` followed by type narrowing.
2. **Linter and Formatting**:
   - **Oxlint** (`.oxlintrc.json`, presets in `@semcache/eslint-config`) is used for static analysis, including the `--type-aware` flag for backend services.
   - **Prettier** (`.prettierrc`) is used for code formatting.
   - No changes are considered complete if `pnpm lint`, `pnpm typecheck`, or `pnpm build` fails.
3. **Configuration and Secrets**:
   - All environment parameters, service URLs, ports, and secrets are passed **exclusively via environment variables** (`process.env`).
   - **Prohibited**: hardcoding passwords, tokens, API keys, or connection strings in source code. Whenever a new environment variable is added, `.env.example` must be updated.

---

## 5. Testing Requirements

1. **Testing Levels**:
   - **Unit tests (`*.spec.ts`)**: placed alongside source code in each microservice's `src/` directory and executed with Jest (`pnpm test`).
   - **Service E2E tests (`test/*.e2e-spec.ts`)**: test the transport layer (`HTTP` for `api-gateway`, `Transport.TCP` for internal microservices) of an individual NestJS service in isolation (`pnpm test:e2e`).
   - **System integration and load tests**: located in the root `tests/` directory (`tests/integration`, `tests/e2e`, `tests/load`).
2. **Mandatory Checks Before Task Completion**:
   - Before reporting completion of any development stage, the following commands must pass:
     ```bash
     pnpm build
     pnpm lint
     pnpm typecheck
     pnpm test
     ```
