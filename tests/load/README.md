# Load tests and caching benchmark

Benchmark assets for comparing the three caching modes (`no-cache`, `fixed`, `adaptive`) on a labeled
telecom workload (Ukrainian + English).

| File                                                                                     | Purpose                                                            |
| :--------------------------------------------------------------------------------------- | :----------------------------------------------------------------- |
| [`generate-dataset.ts`](./generate-dataset.ts)                                           | Deterministic generator (no dependencies, Node >= 22.18 / 24)      |
| [`dataset-content.ts`](./dataset-content.ts)                                             | Hand-authored intents, traps, edge templates, KB sources/scenarios |
| [`loadtest.js`](./loadtest.js)                                                           | k6 script: 2,000-request replay + post-load KB invalidation check  |
| [`../../datasets/labeled/dataset_2000.jsonl`](../../datasets/labeled/dataset_2000.jsonl) | Generated dataset (committed, reproducible)                        |
| [`../../datasets/labeled/kb_updates.json`](../../datasets/labeled/kb_updates.json)       | KB source catalog + 5 invalidation scenarios                       |

## 1. Dataset

```bash
node tests/load/generate-dataset.ts                  # seed 20260501 -> datasets/labeled/
node tests/load/generate-dataset.ts --seed 7 --out-dir /tmp/ds
```

The same seed always produces byte-identical files. The generator validates its own invariants
(counts, ratios, ordering, KB references, prompt uniqueness) and exits non-zero on violation.

### Composition (seed `20260501`)

| Type                  | Count | Share | `expected_behavior`   |
| :-------------------- | ----: | ----: | :-------------------- |
| `canonical_seed`      |    84 |  4.2% | `cache_miss_required` |
| `paraphrase`          | 1,332 | 66.6% | `cache_hit_ok`        |
| `near_duplicate_trap` |   168 |  8.4% | `cache_miss_required` |
| `unique_edge`         |   416 | 20.8% | `cache_miss_required` |

Total repeats/paraphrases: 66.6%; new/edge/trap: 33.4%. 1,000 `uk` + 1,000 `en`; all 2,000 prompts are lexically distinct.

## 2. Environment Setup for Local Benchmarking

1. **Start infrastructure (PostgreSQL + pgvector, Prometheus, Grafana):**

   ```bash
   pnpm infra:up
   pnpm --filter @semcache/auth-service db:migrate
   pnpm --filter @semcache/dialog-service db:migrate
   pnpm --filter @semcache/semantic-cache-service db:migrate
   pnpm --filter @semcache/knowledge-base-service db:migrate
   ```

   - Prometheus UI: `http://localhost:9090` (scrapes `api-gateway` at `/metrics`)
   - Grafana UI: `http://localhost:3100` (default login `admin` / `admin`, pre-provisioned SemCache Overview dashboard)

2. **Start LM Studio** with `qwen/qwen3-1.7b` (`support-llm`), `parallel: 4`, serving on `http://localhost:1234/v1/chat/completions`.

3. **Start backend microservices in test + local LLM mode:**

   Setting `NODE_ENV=test` (outside Jest) relaxes CSRF, cookie sessions, auth guards, and rate limits strictly for automated load testing, while `LLM_PROVIDER=lmstudio` routes LLM requests to LM Studio without requiring `OPENROUTER_API_KEY`:

   ```bash
   # Option A: In-process @huggingface/transformers chat + embeddings (no external LLM server needed)
   NODE_ENV=test LLM_PROVIDER=transformers pnpm dev

   # Option B: Local LM Studio server
   NODE_ENV=test LLM_PROVIDER=lmstudio LM_STUDIO_BASE_URL=http://localhost:1234/v1 pnpm dev
   ```

## 3. Running `loadtest.js`

`loadtest.js` uses existing `api-gateway` endpoints (`POST /dialogs`, `POST /dialogs/:id/messages`, `PATCH /admin/semantic-cache/settings`, `DELETE /admin/semantic-cache/entries`, `GET/POST /knowledge-base/documents`, `POST /knowledge-base/documents/:id/reprocess`) and clears the cache before each run. Upload [`../../docs/telecom-knowledge-base.md`](../../docs/telecom-knowledge-base.md) yourself (or set `SEED_KB_ON_START=true` to seed the 21 synthetic KB documents).

```bash
# Smoke test (50 requests)
CACHE_MODE=adaptive TOTAL_REQUESTS=50 k6 run tests/load/loadtest.js

# Full 3-mode comparison
mkdir -p results
for mode in no-cache fixed adaptive; do
  CACHE_MODE=$mode THRESHOLD=0.90 API_BASE_URL=http://localhost:3000 \
    SUMMARY_OUT=results/$mode.json k6 run tests/load/loadtest.js
done
```

| Variable                                                 | Default                 | Meaning                                                          |
| :------------------------------------------------------- | :---------------------- | :--------------------------------------------------------------- |
| `CACHE_MODE`                                             | `adaptive`              | `no-cache` \| `fixed` \| `adaptive`                              |
| `API_BASE_URL`                                           | `http://localhost:3000` | Gateway URL                                                      |
| `THRESHOLD`                                              | `0.90`                  | Fixed cosine threshold (`fixed` only)                            |
| `MODEL`                                                  | empty                   | Optional model override (e.g., `support-llm`, `qwen/qwen3-1.7b`) |
| `VUS`                                                    | `4`                     | Concurrency = LM Studio `parallel`                               |
| `TOTAL_REQUESTS`                                         | `2000`                  | Capped at dataset size                                           |
| `CLEAR_CACHE_ON_START`                                   | `true`                  | Clears `semantic_cache_entries` before the run                   |
| `SEED_KB_ON_START`                                       | `true`                  | Idempotently seeds/restores the 21 KB sources (`v1`)             |
| `RESTORE_KB_AFTER_TEST`                                  | `true`                  | Restores updated KB docs to `v1` after `teardown()`              |
| `RUN_KB_INVALIDATION`, `KB_INVALIDATION_TIMEOUT`         | `true`, `5m`            | Post-load phase toggle and teardown timeout                      |
| `AUTH_TOKEN`, `ADMIN_TOKEN`, `SESSION_COOKIE`, `API_KEY` | empty                   | Optional credentials when not running in `NODE_ENV=test`         |
| `SUMMARY_OUT`                                            | empty                   | Write structured JSON report to this path                        |

## 4. Metrics

| Thesis metric            | k6 metric(s)                                                                                                               |
| :----------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| Latency p50/p95/p99      | `support_req_duration_ms`, `support_latency_{hit,miss,bypass}_ms`                                                          |
| Throughput               | `support_chat_requests_total` / `load_phase_duration_s` (`throughput_rps`)                                                 |
| Hit rate                 | `cache_hit_rate`, `cache_hits_total`; paraphrase recall: `cache_paraphrase_recall_rate`                                    |
| False-hit rate/precision | `cache_false_hit_rate`, `cache_false_hits_total`, `cache_trap_false_hits_total`, `cache_miss_required_false_positive_rate` |
| Token / cost savings     | `llm_*_tokens_total`, `cache_tokens_saved_total`, `llm_estimated_cost_usd`, `cache_estimated_cost_saved_usd`               |
| Stale-answer prevention  | `kb_invalidation_miss_rate`, `kb_stale_answer_prevented_rate`, `kb_reverify_hit_rate`, `kb_fresh_fact_rate`                |
