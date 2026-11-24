/**
 * k6 load test for the SemCache telecom support benchmark.
 *
 * Compares three caching modes under identical load:
 *   no-cache  every request goes to the LLM (expected cache status: BYPASS)
 *   fixed     pgvector semantic cache with a fixed cosine threshold (THRESHOLD, default 0.90)
 *   adaptive  adaptive threshold (category + local cluster density)
 *
 * Phase 1 (default function): replays dataset_2000.jsonl once, in dataset order, through a
 *          shared-iterations scenario (every row is sent exactly once, by exactly one VU).
 * Phase 2 (teardown):         updates KB sources, re-sends affected queries and verifies that
 *          stale cached answers were invalidated.
 *
 * Run (from the repo root):
 *   CACHE_MODE=adaptive k6 run tests/load/loadtest.js
 *   CACHE_MODE=fixed THRESHOLD=0.90 TOTAL_REQUESTS=50 k6 run tests/load/loadtest.js   # smoke test
 *
 * Expected HTTP contract (see tests/load/README.md):
 *   POST {API_BASE_URL}/api/v1/support/chat      -> answer, cacheStatus (HIT|MISS|BYPASS), usage, ...
 *   PATCH {API_BASE_URL}/api/v1/kb/sources/:id   -> updates a KB source and invalidates linked cache entries
 */
import http from 'k6/http';
import exec from 'k6/execution';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Configuration (all via environment variables)
// ---------------------------------------------------------------------------
const CACHE_MODE = (__ENV.CACHE_MODE || 'adaptive').toLowerCase();
const API_BASE_URL = (__ENV.API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const THRESHOLD = Number.parseFloat(__ENV.THRESHOLD || '0.90');
const CHAT_ENDPOINT = __ENV.CHAT_ENDPOINT || '/api/v1/support/chat';
const KB_SOURCE_ENDPOINT = __ENV.KB_SOURCE_ENDPOINT || '/api/v1/kb/sources';
const KB_UPDATE_METHOD = (__ENV.KB_UPDATE_METHOD || 'PATCH').toUpperCase();
const DATASET_PATH = __ENV.DATASET_PATH || '../../datasets/labeled/dataset_2000.jsonl';
const KB_UPDATES_PATH = __ENV.KB_UPDATES_PATH || '../../datasets/labeled/kb_updates.json';

// Concurrency tuned for LENOVO LOQ 15IAX9I + LM Studio `parallel: 4`: 4 VUs keep every LM Studio
// slot busy without queueing requests inside LM Studio (which would inflate latency numbers).
const VUS = Number.parseInt(__ENV.VUS || '4', 10);
const REQUESTED_TOTAL = Number.parseInt(__ENV.TOTAL_REQUESTS || '2000', 10);
const MAX_DURATION = __ENV.MAX_DURATION || '90m';
const REQUEST_TIMEOUT = __ENV.REQUEST_TIMEOUT || '90s';
const KB_INVALIDATION_TIMEOUT = __ENV.KB_INVALIDATION_TIMEOUT || '5m';
const RUN_KB_INVALIDATION = (__ENV.RUN_KB_INVALIDATION || 'true').toLowerCase() === 'true';
const KB_PROPAGATION_MS = Number.parseInt(__ENV.KB_PROPAGATION_MS || '250', 10);
const THINK_TIME_MS = Number.parseInt(__ENV.THINK_TIME_MS || '50', 10);

// Optional auth: cookie session, bearer token or API key. KB updates need an admin identity.
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || AUTH_TOKEN;
const SESSION_COOKIE = __ENV.SESSION_COOKIE || '';
const API_KEY = __ENV.API_KEY || '';

// Token / cost model. Reference cloud prices (USD per 1M tokens) used to monetize local token counts.
const BASELINE_TOKENS_PER_REQ = Number.parseInt(__ENV.BASELINE_TOKENS_PER_REQ || '450', 10);
const COST_PER_1M_PROMPT = Number.parseFloat(__ENV.COST_PER_1M_PROMPT_TOKENS || '0.15');
const COST_PER_1M_COMPLETION = Number.parseFloat(__ENV.COST_PER_1M_COMPLETION_TOKENS || '0.60');
const PROMPT_TOKEN_SHARE = 0.6; // used only to blend prices when only total tokens are known
const SUMMARY_OUT = __ENV.SUMMARY_OUT || '';

if (!['no-cache', 'fixed', 'adaptive'].includes(CACHE_MODE)) {
  throw new Error(`CACHE_MODE must be one of no-cache|fixed|adaptive, got "${CACHE_MODE}"`);
}
if (!(THRESHOLD > 0 && THRESHOLD <= 1)) {
  throw new Error(`THRESHOLD must be in (0, 1], got "${__ENV.THRESHOLD}"`);
}
if (!['PATCH', 'PUT'].includes(KB_UPDATE_METHOD)) {
  throw new Error(`KB_UPDATE_METHOD must be PATCH or PUT, got "${KB_UPDATE_METHOD}"`);
}

// ---------------------------------------------------------------------------
// Data (SharedArray: parsed once, shared read-only across all VUs)
// ---------------------------------------------------------------------------
const dataset = new SharedArray('telecom_dataset_2000', () =>
  open(DATASET_PATH)
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line)),
);

const scenarios = new SharedArray(
  'kb_invalidation_scenarios',
  () => JSON.parse(open(KB_UPDATES_PATH)).invalidation_scenarios,
);

const TOTAL_REQUESTS = Math.min(REQUESTED_TOTAL, dataset.length);

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
// Latency (ms), overall and split by cache status
const reqDuration = new Trend('support_req_duration_ms', true);
const hitLatency = new Trend('support_latency_hit_ms', true);
const missLatency = new Trend('support_latency_miss_ms', true);
const bypassLatency = new Trend('support_latency_bypass_ms', true);

// Cache behaviour
const chatRequests = new Counter('support_chat_requests_total');
const cacheHits = new Counter('cache_hits_total');
const cacheMisses = new Counter('cache_misses_total');
const cacheBypass = new Counter('cache_bypass_total');
const cacheErrors = new Counter('cache_errors_total');
const hitRate = new Rate('cache_hit_rate'); // HIT / all successful responses
const paraphraseRecall = new Rate('cache_paraphrase_recall_rate'); // HIT on cache_hit_ok rows
const falseHits = new Counter('cache_false_hits_total');
const trapFalseHits = new Counter('cache_trap_false_hits_total');
const falseHitRate = new Rate('cache_false_hit_rate'); // false hits / hits (precision = 1 - this)
const missRequiredFalsePositive = new Rate('cache_miss_required_false_positive_rate'); // over cache_miss_required rows

// Tokens and money
const promptTokens = new Counter('llm_prompt_tokens_total');
const completionTokens = new Counter('llm_completion_tokens_total');
const totalTokens = new Counter('llm_total_tokens_total');
const usageMissing = new Counter('llm_usage_missing_total');
const tokensSaved = new Counter('cache_tokens_saved_total');
const llmCost = new Counter('llm_estimated_cost_usd');
const costSaved = new Counter('cache_estimated_cost_saved_usd');

// KB invalidation phase
const loadPhaseDuration = new Trend('load_phase_duration_s');
const kbInvalidationLatency = new Trend('kb_invalidation_latency_ms', true);
const kbUpdates = new Counter('kb_update_requests_total');
const kbUpdateSuccess = new Rate('kb_update_success_rate');
const kbChecks = new Counter('kb_invalidation_checks_total');
const kbInvalidationMiss = new Rate('kb_invalidation_miss_rate'); // first post-update query is NOT a HIT
const kbStalePrevented = new Rate('kb_stale_answer_prevented_rate'); // not a HIT and no stale facts in the answer
const kbReverifyHit = new Rate('kb_reverify_hit_rate'); // fresh answer gets re-cached
const kbFreshFact = new Rate('kb_fresh_fact_rate'); // fact probes mention the updated fact

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------
const thresholds = {
  http_req_failed: ['rate<0.05'],
  checks: ['rate>0.95'],
};
if (RUN_KB_INVALIDATION && CACHE_MODE !== 'no-cache') {
  thresholds.kb_invalidation_miss_rate = ['rate>=0.95'];
  thresholds.kb_stale_answer_prevented_rate = ['rate>=0.95'];
}

export const options = {
  scenarios: {
    telecom_support_load: {
      executor: 'shared-iterations',
      vus: VUS,
      iterations: TOTAL_REQUESTS,
      maxDuration: MAX_DURATION,
      gracefulStop: '2m',
    },
  },
  thresholds,
  teardownTimeout: KB_INVALIDATION_TIMEOUT,
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let observedTokenSum = 0; // per-VU rolling average of tokens consumed by uncached calls
let observedTokenCount = 0;

function buildHeaders(token) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Cache-Mode': CACHE_MODE,
  };
  if (CACHE_MODE === 'fixed') headers['X-Cache-Threshold'] = String(THRESHOLD);
  if (token) headers.Authorization = `Bearer ${token}`;
  if (SESSION_COOKIE) headers.Cookie = SESSION_COOKIE;
  if (API_KEY) headers['X-API-Key'] = API_KEY;
  return headers;
}

function buildChatPayload(item) {
  const payload = {
    requestId: item.id,
    prompt: item.prompt,
    language: item.language,
    category: item.category,
    cacheMode: CACHE_MODE,
  };
  if (CACHE_MODE === 'fixed') payload.similarityThreshold = THRESHOLD;
  return payload;
}

function firstDefined(...values) {
  return values.find((v) => v !== undefined && v !== null);
}

/** Normalizes raw NestJS JSON and the `{ success, data }` envelope into one flat shape. */
function parseChatResponse(res) {
  let body = null;
  try {
    body = res.json();
  } catch {
    body = null;
  }
  const root =
    body && typeof body === 'object' && body.data && typeof body.data === 'object'
      ? body.data
      : body || {};
  const evaluation = root.evaluation || root.cache || {};
  const usage = root.usage || root.tokenUsage || {};

  const rawStatus = firstDefined(
    res.headers['X-Cache-Status'],
    res.headers['x-cache-status'],
    root.cacheStatus,
    root.cache_status,
    evaluation.cacheStatus,
    evaluation.status,
  );
  const prompt = firstDefined(usage.promptTokens, usage.prompt_tokens);
  const completion = firstDefined(usage.completionTokens, usage.completion_tokens);
  let total = firstDefined(usage.totalTokens, usage.total_tokens);
  if (total === undefined && prompt !== undefined && completion !== undefined)
    total = prompt + completion;

  return {
    ok: body !== null,
    cacheStatus: rawStatus ? String(rawStatus).toUpperCase() : null,
    answer: String(firstDefined(root.answer, root.content, root.message, '') || ''),
    similarity: firstDefined(root.similarity, evaluation.cosineSimilarity),
    matchedIntentId: firstDefined(root.matchedIntentId, root.matched_intent_id),
    usage: { prompt, completion, total },
    savedTokens: firstDefined(root.savedTokens, root.saved_tokens),
  };
}

function postChat(item, extraTags) {
  const res = http.post(`${API_BASE_URL}${CHAT_ENDPOINT}`, JSON.stringify(buildChatPayload(item)), {
    headers: buildHeaders(AUTH_TOKEN),
    timeout: REQUEST_TIMEOUT,
    tags: Object.assign({ name: 'support_chat', cache_mode: CACHE_MODE }, extraTags),
  });
  return { res, parsed: parseChatResponse(res) };
}

function tokenCost(prompt, completion, total) {
  if (prompt !== undefined && completion !== undefined) {
    return (prompt * COST_PER_1M_PROMPT + completion * COST_PER_1M_COMPLETION) / 1e6;
  }
  const blended =
    PROMPT_TOKEN_SHARE * COST_PER_1M_PROMPT + (1 - PROMPT_TOKEN_SHARE) * COST_PER_1M_COMPLETION;
  return ((total || 0) * blended) / 1e6;
}

/** Substring match that ignores digit-adjacent hits ("0 UAH" must not match inside "50 UAH"). */
function containsMarker(text, marker) {
  const haystack = text.toLowerCase();
  const needle = marker.toLowerCase();
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx < 0) return false;
    const before = idx === 0 ? '' : haystack.charAt(idx - 1);
    const after = haystack.charAt(idx + needle.length);
    const startsBad = /\d/.test(needle.charAt(0)) && /[\d.,]/.test(before);
    const endsBad = /\d/.test(needle.charAt(needle.length - 1)) && /\d/.test(after);
    if (!startsBad && !endsBad) return true;
    from = idx + 1;
  }
}

const anyMarker = (text, markers) => markers.some((m) => containsMarker(text, m));

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
export function setup() {
  console.log(
    `[semcache] mode=${CACHE_MODE} threshold=${CACHE_MODE === 'fixed' ? THRESHOLD : 'n/a'} ` +
      `vus=${VUS} requests=${TOTAL_REQUESTS}/${dataset.length} api=${API_BASE_URL}`,
  );
  const health = http.get(`${API_BASE_URL}/health`, { timeout: '5s', tags: { name: 'health' } });
  if (health.status !== 200) {
    console.warn(`[semcache] ${API_BASE_URL}/health returned ${health.status}; continuing anyway`);
  }
  return { startedAt: Date.now() };
}

export default function () {
  // `iterationInTest` is unique across all VUs, so every dataset row is sent exactly once.
  const item = dataset[exec.scenario.iterationInTest];
  const { res, parsed } = postChat(item, {
    category: item.category,
    language: item.language,
    cluster_density: item.cluster_density,
    query_type: item.query_type,
    expected_behavior: item.expected_behavior,
  });

  chatRequests.add(1);
  const valid = check(res, {
    'chat status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'chat body is JSON': () => parsed.ok,
    'chat answer is not empty': () => parsed.answer.length > 0,
  });

  let status = parsed.cacheStatus;
  if (!status && CACHE_MODE === 'no-cache') status = 'BYPASS';
  if (!valid || !['HIT', 'MISS', 'BYPASS'].includes(status)) {
    cacheErrors.add(1);
    return;
  }

  // Latency, overall and per cache status
  reqDuration.add(res.timings.duration);
  if (status === 'HIT') hitLatency.add(res.timings.duration);
  else if (status === 'MISS') missLatency.add(res.timings.duration);
  else bypassLatency.add(res.timings.duration);

  // Hit rate and false hits. A HIT is false when the row requires a miss (first occurrence, trap,
  // edge case) or when the backend reports a different matched intent than the labeled one.
  const isHit = status === 'HIT';
  const mustMiss = item.expected_behavior === 'cache_miss_required';
  hitRate.add(isHit);
  if (status === 'HIT') cacheHits.add(1);
  else if (status === 'MISS') cacheMisses.add(1);
  else cacheBypass.add(1);

  if (!mustMiss) paraphraseRecall.add(isHit);
  else missRequiredFalsePositive.add(isHit);
  if (isHit) {
    const wrongIntent =
      parsed.matchedIntentId !== undefined && parsed.matchedIntentId !== item.intent_id;
    const isFalse = mustMiss || wrongIntent;
    falseHitRate.add(isFalse);
    if (isFalse) {
      falseHits.add(1);
      if (item.query_type === 'near_duplicate_trap') trapFalseHits.add(1);
    }
  }

  // Tokens and cost
  if (isHit) {
    const saved = firstDefined(
      parsed.savedTokens,
      observedTokenCount > 0 ? Math.round(observedTokenSum / observedTokenCount) : undefined,
      BASELINE_TOKENS_PER_REQ,
    );
    tokensSaved.add(saved);
    costSaved.add(tokenCost(undefined, undefined, saved));
  } else if (parsed.usage.total !== undefined) {
    const { prompt, completion, total } = parsed.usage;
    totalTokens.add(total);
    if (prompt !== undefined) promptTokens.add(prompt);
    if (completion !== undefined) completionTokens.add(completion);
    llmCost.add(tokenCost(prompt, completion, total));
    observedTokenSum += total;
    observedTokenCount += 1;
  } else {
    usageMissing.add(1);
  }

  if (THINK_TIME_MS > 0) sleep(THINK_TIME_MS / 1000);
}

/**
 * Post-load KB invalidation check: for each scenario, update a KB source, re-send queries that were
 * cached during the load phase and verify none is served from a stale cache entry.
 */
export function teardown(data) {
  loadPhaseDuration.add((Date.now() - data.startedAt) / 1000);
  if (!RUN_KB_INVALIDATION) {
    console.log('[semcache] KB invalidation phase skipped (RUN_KB_INVALIDATION=false)');
    return;
  }

  for (let s = 0; s < scenarios.length; s += 1) {
    const scenario = scenarios[s];
    const update = http.request(
      KB_UPDATE_METHOD,
      `${API_BASE_URL}${KB_SOURCE_ENDPOINT}/${scenario.kb_source_id}`,
      JSON.stringify(scenario.update_payload),
      {
        headers: buildHeaders(ADMIN_TOKEN),
        timeout: REQUEST_TIMEOUT,
        tags: { name: 'kb_source_update', scenario: scenario.scenario_id },
      },
    );
    const updated = update.status >= 200 && update.status < 300;
    kbUpdates.add(1);
    kbUpdateSuccess.add(updated);
    check(update, { 'KB source update is 2xx': () => updated });
    if (!updated) {
      console.error(`[semcache] KB update ${scenario.kb_source_id} failed: HTTP ${update.status}`);
      continue; // nothing to verify if the source was not updated
    }
    if (KB_PROPAGATION_MS > 0) sleep(KB_PROPAGATION_MS / 1000);

    scenario.verification_queries.forEach((query, i) => {
      const item = {
        id: `${query.record_id}-kbu`,
        prompt: query.prompt,
        language: query.language,
        category: scenario.category,
      };
      const { res, parsed } = postChat(item, {
        phase: 'kb_invalidation',
        scenario: scenario.scenario_id,
      });
      kbChecks.add(1);
      kbInvalidationLatency.add(res.timings.duration);

      const notHit = parsed.cacheStatus !== 'HIT';
      const stale =
        anyMarker(parsed.answer, scenario.stale_markers) &&
        !anyMarker(parsed.answer, scenario.fresh_markers);
      kbInvalidationMiss.add(notHit);
      kbStalePrevented.add(notHit && !stale);
      if (!notHit || stale) {
        console.warn(
          `[semcache] STALE ${scenario.scenario_id} q${i}: status=${parsed.cacheStatus} stale=${stale}`,
        );
      }

      // The first query was just re-answered from the updated KB; asking again should hit the new entry.
      if (i === 0 && CACHE_MODE !== 'no-cache') {
        const again = postChat(item, { phase: 'kb_reverify', scenario: scenario.scenario_id });
        kbReverifyHit.add(again.parsed.cacheStatus === 'HIT');
      }
    });

    // Fact probes: not cached before, so they only test that retrieval uses the updated KB content.
    scenario.fact_probe_queries.forEach((probe, i) => {
      const item = {
        id: `${scenario.scenario_id}-probe-${i}`,
        prompt: probe.prompt,
        language: probe.language,
        category: scenario.category,
      };
      const { parsed } = postChat(item, { phase: 'kb_probe', scenario: scenario.scenario_id });
      kbFreshFact.add(anyMarker(parsed.answer, scenario.fresh_markers));
    });
  }
}

// ---------------------------------------------------------------------------
// Summary (console report + optional JSON export for the thesis tables)
// ---------------------------------------------------------------------------
export function handleSummary(data) {
  const m = data.metrics;
  const val = (name, key, fallback = 0) =>
    m[name] && m[name].values[key] !== undefined ? m[name].values[key] : fallback;
  const count = (name) => val(name, 'count');
  const rate = (name) => val(name, 'rate');
  const lat = (name) => ({
    avg: val(name, 'avg'),
    p50: val(name, 'med'),
    p95: val(name, 'p(95)'),
    p99: val(name, 'p(99)'),
    max: val(name, 'max'),
  });

  const requests = count('support_chat_requests_total');
  const phaseSeconds = val('load_phase_duration_s', 'max', data.state.testRunDurationMs / 1000);
  const hits = count('cache_hits_total');
  const falseHitCount = count('cache_false_hits_total');
  const baselineCost = count('llm_estimated_cost_usd') + count('cache_estimated_cost_saved_usd');

  const report = {
    run: {
      cache_mode: CACHE_MODE,
      threshold: CACHE_MODE === 'fixed' ? THRESHOLD : null,
      vus: VUS,
      requests,
    },
    throughput_rps: phaseSeconds > 0 ? requests / phaseSeconds : 0,
    load_phase_seconds: phaseSeconds,
    latency_ms: {
      overall: lat('support_req_duration_ms'),
      hit: lat('support_latency_hit_ms'),
      miss: lat('support_latency_miss_ms'),
      bypass: lat('support_latency_bypass_ms'),
    },
    cache: {
      hits,
      misses: count('cache_misses_total'),
      bypass: count('cache_bypass_total'),
      errors: count('cache_errors_total'),
      hit_rate: rate('cache_hit_rate'),
      paraphrase_recall: rate('cache_paraphrase_recall_rate'),
      false_hits: falseHitCount,
      false_hit_rate: rate('cache_false_hit_rate'),
      precision: hits > 0 ? 1 - rate('cache_false_hit_rate') : null,
      trap_false_hits: count('cache_trap_false_hits_total'),
      miss_required_false_positive_rate: rate('cache_miss_required_false_positive_rate'),
    },
    tokens_and_cost: {
      llm_total_tokens: count('llm_total_tokens_total'),
      llm_prompt_tokens: count('llm_prompt_tokens_total'),
      llm_completion_tokens: count('llm_completion_tokens_total'),
      tokens_saved_estimated: count('cache_tokens_saved_total'),
      llm_cost_usd: count('llm_estimated_cost_usd'),
      cost_saved_usd: count('cache_estimated_cost_saved_usd'),
      savings_vs_uncached_baseline:
        baselineCost > 0 ? count('cache_estimated_cost_saved_usd') / baselineCost : 0,
      usage_missing_responses: count('llm_usage_missing_total'),
    },
    kb_invalidation: {
      enabled: RUN_KB_INVALIDATION,
      updates: count('kb_update_requests_total'),
      update_success_rate: rate('kb_update_success_rate'),
      checks: count('kb_invalidation_checks_total'),
      invalidation_miss_rate: rate('kb_invalidation_miss_rate'),
      stale_answer_prevented_rate: rate('kb_stale_answer_prevented_rate'),
      reverify_hit_rate: rate('kb_reverify_hit_rate'),
      fresh_fact_rate: rate('kb_fresh_fact_rate'),
      latency_ms: lat('kb_invalidation_latency_ms'),
    },
  };

  const f = (n, d = 1) => Number(n).toFixed(d);
  const pct = (n) => `${f(n * 100)}%`;
  const row = (label, l) =>
    `  ${label.padEnd(8)} p50=${f(l.p50)}  p95=${f(l.p95)}  p99=${f(l.p99)}  avg=${f(l.avg)}`;
  const text = [
    '',
    `=== SemCache benchmark: mode=${CACHE_MODE}${CACHE_MODE === 'fixed' ? ` threshold=${THRESHOLD}` : ''} ===`,
    `requests=${requests}  duration=${f(phaseSeconds)}s  throughput=${f(report.throughput_rps, 3)} req/s  errors=${report.cache.errors}`,
    'latency (ms):',
    row('overall', report.latency_ms.overall),
    row('HIT', report.latency_ms.hit),
    row('MISS', report.latency_ms.miss),
    row('BYPASS', report.latency_ms.bypass),
    `cache: hit_rate=${pct(report.cache.hit_rate)}  paraphrase_recall=${pct(report.cache.paraphrase_recall)}  ` +
      `false_hit_rate=${pct(report.cache.false_hit_rate)}  precision=${report.cache.precision === null ? 'n/a' : pct(report.cache.precision)}`,
    `       hits=${hits}  false_hits=${falseHitCount}  trap_false_hits=${report.cache.trap_false_hits}  ` +
      `miss_required_false_positive=${pct(report.cache.miss_required_false_positive_rate)}`,
    `tokens: llm_total=${report.tokens_and_cost.llm_total_tokens}  saved_est=${report.tokens_and_cost.tokens_saved_estimated}  ` +
      `cost=$${f(report.tokens_and_cost.llm_cost_usd, 4)}  saved=$${f(report.tokens_and_cost.cost_saved_usd, 4)} ` +
      `(${pct(report.tokens_and_cost.savings_vs_uncached_baseline)} vs uncached)`,
    RUN_KB_INVALIDATION
      ? `kb invalidation: updates_ok=${pct(report.kb_invalidation.update_success_rate)}  not_hit=${pct(report.kb_invalidation.invalidation_miss_rate)}  ` +
        `stale_prevented=${pct(report.kb_invalidation.stale_answer_prevented_rate)}  reverify_hit=${pct(report.kb_invalidation.reverify_hit_rate)}  ` +
        `fresh_fact=${pct(report.kb_invalidation.fresh_fact_rate)}  (checks=${report.kb_invalidation.checks})`
      : 'kb invalidation: skipped',
    '',
  ].join('\n');

  const outputs = { stdout: text };
  if (SUMMARY_OUT) outputs[SUMMARY_OUT] = JSON.stringify(report, null, 2);
  return outputs;
}
