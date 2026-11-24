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

### Record schema (one JSON object per line)

| Field                              | Description                                                                                                                                            |
| :--------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                               | `req-0001` … `req-2000`; also the replay order                                                                                                         |
| `language`                         | `uk` \| `en`                                                                                                                                           |
| `category`                         | `billing`, `roaming`, `tariff_plan`, `sim_esim`, `technical_support`, `outage_incident`, `contract_termination`                                        |
| `intent_id`                        | Ground-truth intent. Traps use `trap_<intent>_<n>`, edge queries `edge_<template>_<n>` (never equal to a cacheable intent)                             |
| `cluster_density`                  | `high` \| `medium` \| `low` — how many paraphrases the intent has (28-29 / 14 / 5 per language)                                                        |
| `kb_source_id`                     | KB source the correct answer depends on (21 sources, 3 per category)                                                                                   |
| `is_paraphrase_of_existing`        | `true` only for genuine paraphrases of an already-seen intent                                                                                          |
| `expected_behavior`                | `cache_hit_ok` \| `cache_miss_required`                                                                                                                |
| `prompt`                           | Customer text with prefixes/suffixes, typos, abbreviations and casual style                                                                            |
| `query_type`                       | `canonical_seed` \| `paraphrase` \| `near_duplicate_trap` \| `unique_edge` (diagnostics)                                                               |
| `trap_of_intent_id`, `trap_reason` | For traps: the look-alike intent and the condition that makes the cached answer wrong (EU vs non-EU, prepaid vs postpaid, plan/amount, SIM vs eSIM, …) |

### Composition (seed `20260501`)

| Type                  | Count | Share | `expected_behavior`   |
| :-------------------- | ----: | ----: | :-------------------- |
| `canonical_seed`      |    84 |  4.2% | `cache_miss_required` |
| `paraphrase`          | 1,332 | 66.6% | `cache_hit_ok`        |
| `near_duplicate_trap` |   168 |  8.4% | `cache_miss_required` |
| `unique_edge`         |   416 | 20.8% | `cache_miss_required` |

Total repeats/paraphrases: 66.6%; new/edge/trap: 33.4%. 1,000 `uk` + 1,000 `en`; all 2,000 prompts are lexically distinct, so
exact-match caching would never hit — only semantic similarity can.

**Ordering guarantee:** every paraphrase and trap appears at least 20 positions after the canonical seed of its
(intent, language). With 4 concurrent VUs a correct cache therefore always already holds the entry. Unique-edge rows of the
same template differ only in a slot value (error code, country, amount), so they intentionally stress `fixed` thresholds
as well.

### `kb_updates.json`

- `kb_sources` — the 21 KB sources (`v1` content, EN + UK).
- `invalidation_scenarios` — 5 policy changes (EU roaming limit, plan-change fee, SIM replacement price, autopay discount,
  cancellation notice). Each has `update_payload` (body for the KB update call), `stale_markers` / `fresh_markers`,
  4 `verification_queries` (seed + paraphrase per language, taken from the dataset so they were cached during the load phase)
  and 2 `fact_probe_queries`.

## 2. Environment

- Docker Compose stack (PostgreSQL 17 + pgvector, NestJS services, Prometheus, Grafana) running.
- LM Studio: model `support-llm` (`qwen/qwen3-1.7b`), `parallel: 4`, `http://localhost:1234/v1/chat/completions`;
  point the `llm-service` override at it for the load test so no external rate limits apply.
- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) >= 0.50.

> [!IMPORTANT]
> `loadtest.js` targets the REST contract `POST /api/v1/support/chat` and `PATCH /api/v1/kb/sources/:id`.
> The current `api-gateway` exposes `/dialogs/:id/messages`, `/knowledge-base/documents/:id/reprocess` and
> `/admin/semantic-cache/*` instead. Either add thin gateway routes with the contract below, or override
> `CHAT_ENDPOINT` / `KB_SOURCE_ENDPOINT` and adapt the payload/parse helpers in `loadtest.js`
> (`buildChatPayload`, `parseChatResponse`). The gateway also uses cookie sessions + CSRF protection — pass
> `SESSION_COOKIE` / `AUTH_TOKEN` / `ADMIN_TOKEN` as needed.

### Expected contract

```jsonc
// POST /api/v1/support/chat
// request headers: X-Cache-Mode: no-cache|fixed|adaptive, X-Cache-Threshold (fixed only)
{ "requestId": "req-0001", "prompt": "…", "language": "uk", "category": "billing",
  "cacheMode": "adaptive", "similarityThreshold": 0.9 /* fixed only */ }
// response (raw JSON or { success, data } envelope)
{ "answer": "…", "cacheStatus": "HIT|MISS|BYPASS",       // or header X-Cache-Status
  "similarity": 0.93, "matchedIntentId": "optional",
  "usage": { "promptTokens": 120, "completionTokens": 310, "totalTokens": 430 },  // 0/absent on HIT
  "savedTokens": 430 /* optional */ }

// PATCH /api/v1/kb/sources/:id  (admin) -> must invalidate cache entries linked to the source
{ "title": "…", "category": "…", "version": "v2", "content": "…", "summary": "…",
  "invalidateCache": true, "changeReason": "…" }
```

## 3. Running

```bash
# smoke test (50 requests)
CACHE_MODE=adaptive TOTAL_REQUESTS=50 k6 run tests/load/loadtest.js

# full benchmark: clear the cache between runs so every mode starts cold
for mode in no-cache fixed adaptive; do
  # DELETE /admin/semantic-cache/entries (or truncate semantic_cache_entries) here
  CACHE_MODE=$mode THRESHOLD=0.90 API_BASE_URL=http://localhost:3000 \
    SUMMARY_OUT=results/$mode.json k6 run tests/load/loadtest.js
done
```

| Variable                                                 | Default                                      | Meaning                                             |
| :------------------------------------------------------- | :------------------------------------------- | :-------------------------------------------------- |
| `CACHE_MODE`                                             | `adaptive`                                   | `no-cache` \| `fixed` \| `adaptive`                 |
| `API_BASE_URL`                                           | `http://localhost:3000`                      | Gateway URL                                         |
| `THRESHOLD`                                              | `0.90`                                       | Fixed cosine threshold (`fixed` only)               |
| `VUS`                                                    | `4`                                          | Concurrency = LM Studio `parallel`                  |
| `TOTAL_REQUESTS`                                         | `2000`                                       | Capped at dataset size                              |
| `THINK_TIME_MS`                                          | `50`                                         | Pause per iteration                                 |
| `REQUEST_TIMEOUT` / `MAX_DURATION`                       | `90s` / `90m`                                | Per request / whole load phase                      |
| `RUN_KB_INVALIDATION`, `KB_INVALIDATION_TIMEOUT`         | `true`, `5m`                                 | Post-load phase toggle and teardown timeout         |
| `KB_UPDATE_METHOD`, `KB_PROPAGATION_MS`                  | `PATCH`, `250`                               | `PATCH` \| `PUT`; wait after update                 |
| `CHAT_ENDPOINT`, `KB_SOURCE_ENDPOINT`                    | `/api/v1/support/chat`, `/api/v1/kb/sources` | Route overrides                                     |
| `DATASET_PATH`, `KB_UPDATES_PATH`                        | `../../datasets/labeled/…`                   | Relative to `loadtest.js`                           |
| `AUTH_TOKEN`, `ADMIN_TOKEN`, `SESSION_COOKIE`, `API_KEY` | empty                                        | Optional credentials (`ADMIN_TOKEN` for KB updates) |
| `BASELINE_TOKENS_PER_REQ`                                | `450`                                        | Saved-token fallback when nothing else is known     |
| `COST_PER_1M_PROMPT_TOKENS` / `…_COMPLETION_TOKENS`      | `0.15` / `0.60`                              | Reference cloud prices (USD) to monetize tokens     |
| `SUMMARY_OUT`                                            | empty                                        | Write the structured JSON report to this path       |

## 4. Metrics

| Thesis metric            | k6 metric(s)                                                                                                                                   |
| :----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| Latency p50/p95/p99      | `support_req_duration_ms`, `support_latency_{hit,miss,bypass}_ms`                                                                              |
| Throughput               | `support_chat_requests_total` / `load_phase_duration_s` (reported as `throughput_rps`)                                                         |
| Hit rate                 | `cache_hit_rate`, `cache_hits_total`; paraphrase recall: `cache_paraphrase_recall_rate`                                                        |
| False-hit rate/precision | `cache_false_hit_rate` (false hits / hits), `cache_false_hits_total`, `cache_trap_false_hits_total`, `cache_miss_required_false_positive_rate` |
| Token / cost savings     | `llm_*_tokens_total`, `cache_tokens_saved_total`, `llm_estimated_cost_usd`, `cache_estimated_cost_saved_usd`                                   |
| Stale-answer prevention  | `kb_invalidation_miss_rate`, `kb_stale_answer_prevented_rate`, `kb_reverify_hit_rate`, `kb_fresh_fact_rate`                                    |

Notes and limitations:

- **False hit** = `HIT` on a `cache_miss_required` row (first occurrence, trap, edge case), or a reported `matchedIntentId`
  different from the labeled `intent_id`. It is a label-based proxy: a cached answer for a different but equivalent question is
  counted as false. Answer correctness (accuracy) still needs an offline judge over `prompt` + `answer`; export answers if
  required.
- **Token savings**: on `HIT` the saved tokens are `savedTokens` from the response, else the VU's running average of uncached
  responses, else `BASELINE_TOKENS_PER_REQ`. For thesis tables prefer comparing total tokens of the `no-cache` run against the
  `fixed`/`adaptive` runs.
- **Stale check**: `kb_invalidation_miss_rate` is exact (the first post-update query must not be a `HIT`). Stale-marker matching
  only fires when the LLM answer mentions the changed fact; `kb_fresh_fact_rate` (probe questions) covers the opposite direction.
- In `no-cache` mode all rows are `BYPASS`; hit/false-hit metrics are 0 by construction and serve as the latency/token baseline.
