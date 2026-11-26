# Semantic Cache Architecture (`semantic-cache-service`)

## 1. Overview

`@semcache/semantic-cache-service` is an isolated NestJS microservice (`Transport.TCP`, default port `3003`) backed by PostgreSQL 17 with `pgvector`. It stores telecom customer support query-response pairs, performs cosine similarity vector search with an HNSW index, calculates local embedding cluster density and adaptive similarity thresholds, tracks linked Knowledge Base sources, and persists global caching settings across restarts.

---

## 2. Database Schema & `pgvector`

Managed via Drizzle ORM (`apps/semantic-cache-service/src/db/schema.ts`, migration table `__drizzle_migrations_semantic_cache`):

1. **`semantic_cache_entries`**:
   - Stores `id`, `query`, `response`, `category` (`QueryCategory`), `embedding` (`vector(384)`), `model`, `hit_count`, `last_hit_at`, `metadata`, `created_at`, `updated_at`.
   - Indexed with B-tree on `category` and `created_at`, plus an HNSW cosine index (`vector_cosine_ops`) on `embedding`.
2. **`semantic_cache_entry_sources`**:
   - Links cached responses to Knowledge Base sources (`entry_id` -> `semantic_cache_entries.id` with `ON DELETE CASCADE`, `document_id`, `document_title`, `chunk_id`, `chunk_index`).
   - Indexed by `entry_id` and `document_id` for fast source-based invalidation.
3. **`semantic_cache_settings`**:
   - Singleton row (`id = 'default'`) persisting `mode`, `fixed_threshold`, `adaptive_base_threshold`, `min_adaptive_threshold`, `max_adaptive_threshold`, `density_weight`, `density_k_neighbors`, `category_weights` (JSONB), `updated_by`, `created_at`, `updated_at`.

Apply migrations after starting PostgreSQL:

```bash
pnpm --filter @semcache/semantic-cache-service db:migrate
```

---

## 3. Caching Regimes & Adaptive Threshold Formula

Every lookup uses the persisted global `mode` by default, with optional per-request overrides (`mode`, `fixedThresholdOverride`).

1. **`disabled` (`CacheMode.DISABLED`)**:
   - Bypasses vector search completely and returns `CacheHitStatus.BYPASS` so requests proceed directly to the LLM.
2. **`fixed` (`CacheMode.FIXED`)**:
   - Compares top-1 cosine similarity against `fixedThresholdOverride ?? settings.fixedThreshold` (default `0.90`).
3. **`adaptive` (`CacheMode.ADAPTIVE`)**:
   - Fetches top-$K$ nearest neighbors in the query's `category` ($K = \text{densityKNeighbors}$, default `5`).
   - Computes **local cluster density**:
     $$\rho(q) = \operatorname{clamp}_{[0, 1]}\!\left(\frac{1}{\max(1, K)} \sum_{i=1}^{m} \max(0, s_i)\right)$$
   - Computes **adaptive similarity threshold**:
     $$\tau = \operatorname{clamp}\!\left(\tau_{\text{base}} + w_c + \alpha \cdot \rho(q),\; \tau_{\min},\; \tau_{\max}\right)$$
   - Default telecom category weights ($w_c$):
     - `billing`: `+0.05` (stricter for billing/payment precision)
     - `account_management`: `+0.04`
     - `technical_support`: `+0.01`
     - `product_inquiry`: `-0.02`
     - `general`: `-0.03`

---

## 4. TCP Contracts & Operator REST Endpoints

### Internal TCP Patterns (`SERVICE_TCP_PATTERNS`)

- `cache.lookup` (`@Authenticate({ optional: true })`) — vector lookup and threshold evaluation.
- `cache.store` (`@Authenticate({ optional: true })`) — stores query, response, 384-d embedding, category, and linked KB sources.
- `cache.invalidate.bySources` (`ADMIN`) — deletes all cache entries linked to any of `documentIds`.
- `cache.invalidate.byCategory` (`ADMIN`) — clears all cache entries in a `QueryCategory`.
- `cache.invalidate.unlinked` (`ADMIN`) — deletes all cache entries that have no linked KB sources in `semantic_cache_entry_sources`.
- `cache.clear.all` (`ADMIN`) — clears all cached entries.
- `cache.settings.get` / `cache.settings.update` (`ADMIN`) — reads/updates persisted settings.
- `cache.stats.get` (`ADMIN`) — returns active mode, total entries, total hits, and per-category breakdown.

### API Gateway Operator REST Endpoints (`/admin/semantic-cache`, `UserRole.ADMIN` only)

- `GET /admin/semantic-cache/settings`
- `PATCH /admin/semantic-cache/settings`
- `GET /admin/semantic-cache/stats`
- `POST /admin/semantic-cache/invalidate/sources`
- `DELETE /admin/semantic-cache/entries/category/:category`
- `DELETE /admin/semantic-cache/entries`

---

## 5. Automatic Knowledge Base Invalidation

- `knowledge-base-service` notifies `semantic-cache-service` (`cache.invalidate.bySources`) whenever a Knowledge Base document is reprocessed (`kb.documents.reprocess`, which also accepts optional updated `content`/`title`/`metadata`) or deleted (`kb.documents.delete`), ensuring stale cached answers referencing updated or removed documents are purged automatically.
- `knowledge-base-service` also calls `cache.invalidate.unlinked` whenever a Knowledge Base document is uploaded (`kb.documents.upload`) or reprocessed (`kb.documents.reprocess`) to `READY` status, purging previously ungrounded cached answers (entries with zero rows in `semantic_cache_entry_sources`) so future queries can use the new KB context.
- `dialog-service` (`DialogGraphService`) embeds incoming queries via `embeddings.generate` (`embedding-service`), performs `cache.lookup` before RAG/LLM execution, short-circuits on `HIT` (returning `cache: SemanticCacheTurnMetadataDto` on `SendMessageResponseDto` and `X-Cache-Status` / `X-Cache-Mode` headers on `api-gateway`), and persists `MISS` responses via `cache.store` with linked `knowledgeSourceIds`.

---

## 6. Environment Variables

- `DATABASE_URL` — PostgreSQL connection string.
- `INTERNAL_SERVICE_SECRET` — shared HMAC secret for internal identity verification.
- `SEMANTIC_CACHE_SERVICE_HOST` / `SEMANTIC_CACHE_SERVICE_PORT` (default `127.0.0.1:3003`).
- Optional initial seed defaults (used only when creating the `default` settings row): `SEMANTIC_CACHE_DEFAULT_MODE`, `SEMANTIC_CACHE_FIXED_THRESHOLD`, `SEMANTIC_CACHE_ADAPTIVE_BASE_THRESHOLD`, `SEMANTIC_CACHE_MIN_ADAPTIVE_THRESHOLD`, `SEMANTIC_CACHE_MAX_ADAPTIVE_THRESHOLD`, `SEMANTIC_CACHE_DENSITY_WEIGHT`, `SEMANTIC_CACHE_DENSITY_K_NEIGHBORS`.
