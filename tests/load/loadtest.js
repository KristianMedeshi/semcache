/**
 * k6 load test for the SemCache telecom support benchmark.
 *
 * Uses existing SemCache API Gateway endpoints directly:
 *   GET    /health
 *   DELETE /admin/semantic-cache/entries
 *   PATCH  /admin/semantic-cache/settings
 *   GET    /knowledge-base/documents
 *   POST   /knowledge-base/documents
 *   POST   /knowledge-base/documents/:id/reprocess
 *   POST   /dialogs
 *   POST   /dialogs/:id/messages
 *
 * Compares three caching modes under identical load:
 *   no-cache  every request bypasses semantic cache (cache.status = BYPASS)
 *   fixed     pgvector semantic cache with a fixed cosine threshold (THRESHOLD, default 0.90)
 *   adaptive  adaptive threshold (category + local cluster density)
 *
 * Run (from the repo root, with services started under NODE_ENV=test and LLM_PROVIDER=lmstudio):
 *   CACHE_MODE=adaptive k6 run tests/load/loadtest.js
 *   CACHE_MODE=fixed THRESHOLD=0.90 TOTAL_REQUESTS=50 k6 run tests/load/loadtest.js   # smoke test
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
const MODEL = (__ENV.MODEL || '').trim();
const DATASET_PATH = __ENV.DATASET_PATH || '../../datasets/labeled/dataset_2000.jsonl';
const KB_UPDATES_PATH = __ENV.KB_UPDATES_PATH || '../../datasets/labeled/kb_updates.json';

// Existing gateway routes (overridable if needed)
const DIALOGS_ENDPOINT = __ENV.DIALOGS_ENDPOINT || '/dialogs';
const KB_DOCUMENTS_ENDPOINT = __ENV.KB_DOCUMENTS_ENDPOINT || '/knowledge-base/documents';
const CACHE_SETTINGS_ENDPOINT = __ENV.CACHE_SETTINGS_ENDPOINT || '/admin/semantic-cache/settings';
const CACHE_CLEAR_ENDPOINT = __ENV.CACHE_CLEAR_ENDPOINT || '/admin/semantic-cache/entries';

// Concurrency tuned for LENOVO LOQ 15IAX9I + LM Studio `parallel: 4`: 4 VUs keep every LM Studio
// slot busy without queueing requests inside LM Studio (which would inflate latency numbers).
const VUS = Number.parseInt(__ENV.VUS || '4', 10);
const REQUESTED_TOTAL = Number.parseInt(__ENV.TOTAL_REQUESTS || '2000', 10);
const LOAD_PROFILE = (__ENV.LOAD_PROFILE || 'fixed-iterations').toLowerCase();
const RAMP_STAGES_RAW = __ENV.RAMP_STAGES || '30s:1,45s:2,45s:4,45s:6,30s:0';
const START_RATE = Number.parseInt(__ENV.START_RATE || '1', 10);
const TIME_UNIT = __ENV.TIME_UNIT || '1s';
const PRE_ALLOCATED_VUS = Number.parseInt(__ENV.PRE_ALLOCATED_VUS || '8', 10);
const MAX_VUS = Number.parseInt(__ENV.MAX_VUS || '16', 10);
const MAX_DURATION = __ENV.MAX_DURATION || '90m';
const REQUEST_TIMEOUT = __ENV.REQUEST_TIMEOUT || '90s';
const KB_INVALIDATION_TIMEOUT = __ENV.KB_INVALIDATION_TIMEOUT || '5m';
const RUN_KB_INVALIDATION = (__ENV.RUN_KB_INVALIDATION || 'true').toLowerCase() === 'true';
const CLEAR_CACHE_ON_START = (__ENV.CLEAR_CACHE_ON_START || 'true').toLowerCase() === 'true';
const SEED_KB_ON_START = (__ENV.SEED_KB_ON_START || 'true').toLowerCase() === 'true';
const RESTORE_KB_AFTER_TEST = (__ENV.RESTORE_KB_AFTER_TEST || 'true').toLowerCase() === 'true';
const KB_PROPAGATION_MS = Number.parseInt(__ENV.KB_PROPAGATION_MS || '250', 10);
const THINK_TIME_MS = Number.parseInt(__ENV.THINK_TIME_MS || '50', 10);

// Optional auth: when gateway runs with NODE_ENV=test, synthetic admin auth is automatic.
// For development/production runs, provide SESSION_COOKIE (or AUTH_TOKEN / ADMIN_TOKEN).
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || AUTH_TOKEN;
const SESSION_COOKIE = __ENV.SESSION_COOKIE || '';
const API_KEY = __ENV.API_KEY || '';

// Token / cost model. Reference cloud prices (USD per 1M tokens) used to monetize local token counts.
const BASELINE_TOKENS_PER_REQ = Number.parseInt(__ENV.BASELINE_TOKENS_PER_REQ || '450', 10);
const COST_PER_1M_PROMPT = Number.parseFloat(__ENV.COST_PER_1M_PROMPT_TOKENS || '0.15');
const COST_PER_1M_COMPLETION = Number.parseFloat(__ENV.COST_PER_1M_COMPLETION_TOKENS || '0.60');
const PROMPT_TOKEN_SHARE = 0.6;
const SUMMARY_OUT = __ENV.SUMMARY_OUT || '';

if (!['no-cache', 'fixed', 'adaptive'].includes(CACHE_MODE)) {
  throw new Error(`CACHE_MODE must be one of no-cache|fixed|adaptive, got "${CACHE_MODE}"`);
}
if (!['fixed-iterations', 'ramping-vus', 'ramping-arrival-rate'].includes(LOAD_PROFILE)) {
  throw new Error(
    `LOAD_PROFILE must be one of fixed-iterations|ramping-vus|ramping-arrival-rate, got "${LOAD_PROFILE}"`,
  );
}
if (!(THRESHOLD > 0 && THRESHOLD <= 1)) {
  throw new Error(`THRESHOLD must be in (0, 1], got "${__ENV.THRESHOLD}"`);
}

function parseRampStages(raw) {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const [duration, targetStr] = part.split(':').map((s) => s.trim());
      const target = Number.parseInt(targetStr, 10);
      if (!duration || Number.isNaN(target) || target < 0) {
        throw new Error(`Invalid RAMP_STAGES segment "${part}"; expected "<duration>:<target>"`);
      }
      return { duration, target };
    });
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

const kbData = new SharedArray('kb_updates_data', () => [JSON.parse(open(KB_UPDATES_PATH))]);
const kbSources = kbData[0].kb_sources;
const scenarios = kbData[0].invalidation_scenarios;
const kbBySourceId = Object.fromEntries(kbSources.map((src) => [src.kb_source_id, src]));

const TOTAL_REQUESTS = Math.min(REQUESTED_TOTAL, dataset.length);

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const reqDuration = new Trend('support_req_duration_ms', true);
const hitLatency = new Trend('support_latency_hit_ms', true);
const missLatency = new Trend('support_latency_miss_ms', true);
const bypassLatency = new Trend('support_latency_bypass_ms', true);

const chatRequests = new Counter('support_chat_requests_total');
const cacheHits = new Counter('cache_hits_total');
const cacheMisses = new Counter('cache_misses_total');
const cacheBypass = new Counter('cache_bypass_total');
const cacheErrors = new Counter('cache_errors_total');
const hitRate = new Rate('cache_hit_rate');
const paraphraseRecall = new Rate('cache_paraphrase_recall_rate');
const falseHits = new Counter('cache_false_hits_total');
const trapFalseHits = new Counter('cache_trap_false_hits_total');
const falseHitRate = new Rate('cache_false_hit_rate');
const missRequiredFalsePositive = new Rate('cache_miss_required_false_positive_rate');

const promptTokens = new Counter('llm_prompt_tokens_total');
const completionTokens = new Counter('llm_completion_tokens_total');
const totalTokens = new Counter('llm_total_tokens_total');
const usageMissing = new Counter('llm_usage_missing_total');
const tokensSaved = new Counter('cache_tokens_saved_total');
const llmCost = new Counter('llm_estimated_cost_usd');
const costSaved = new Counter('cache_estimated_cost_saved_usd');

const loadPhaseDuration = new Trend('load_phase_duration_s');
const kbInvalidationLatency = new Trend('kb_invalidation_latency_ms', true);
const kbUpdates = new Counter('kb_update_requests_total');
const kbUpdateSuccess = new Rate('kb_update_success_rate');
const kbChecks = new Counter('kb_invalidation_checks_total');
const kbInvalidationMiss = new Rate('kb_invalidation_miss_rate');
const kbStalePrevented = new Rate('kb_stale_answer_prevented_rate');
const kbReverifyHit = new Rate('kb_reverify_hit_rate');
const kbFreshFact = new Rate('kb_fresh_fact_rate');

const answerAccuracyRate = new Rate('answer_accuracy_rate');
const answerAccurateTotal = new Counter('answer_accurate_total');
const answerInaccurateTotal = new Counter('answer_inaccurate_total');
const answerLanguageMatchRate = new Rate('answer_language_match_rate');
const answerKbGroundedRate = new Rate('answer_kb_grounded_rate');

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

function buildScenarioOptions() {
  if (LOAD_PROFILE === 'ramping-vus') {
    return {
      telecom_support_load: {
        executor: 'ramping-vus',
        startVUs: 1,
        stages: parseRampStages(RAMP_STAGES_RAW),
        gracefulRampDown: '30s',
        gracefulStop: '2m',
      },
    };
  }
  if (LOAD_PROFILE === 'ramping-arrival-rate') {
    return {
      telecom_support_load: {
        executor: 'ramping-arrival-rate',
        startRate: START_RATE,
        timeUnit: TIME_UNIT,
        preAllocatedVUs: PRE_ALLOCATED_VUS,
        maxVUs: MAX_VUS,
        stages: parseRampStages(RAMP_STAGES_RAW),
        gracefulStop: '2m',
      },
    };
  }
  return {
    telecom_support_load: {
      executor: 'shared-iterations',
      vus: VUS,
      iterations: TOTAL_REQUESTS,
      maxDuration: MAX_DURATION,
      gracefulStop: '2m',
    },
  };
}

export const options = {
  scenarios: buildScenarioOptions(),
  thresholds,
  setupTimeout: '5m',
  teardownTimeout: KB_INVALIDATION_TIMEOUT,
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let observedTokenSum = 0;
let observedTokenCount = 0;

function mapMode(mode) {
  return mode === 'no-cache' ? 'disabled' : mode;
}

function mapCategory(category) {
  switch (category) {
    case 'billing':
      return 'billing';
    case 'technical_support':
    case 'outage_incident':
      return 'technical_support';
    case 'sim_esim':
    case 'contract_termination':
      return 'account_management';
    case 'roaming':
    case 'tariff_plan':
      return 'product_inquiry';
    default:
      return 'general';
  }
}

function buildHeaders(token) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (SESSION_COOKIE) headers.Cookie = SESSION_COOKIE;
  if (API_KEY) headers['X-API-Key'] = API_KEY;
  return headers;
}

function buildMessagePayload(prompt, category) {
  const payload = {
    content: prompt,
    parentMessageId: null,
    category: mapCategory(category),
    cacheMode: mapMode(CACHE_MODE),
  };
  if (CACHE_MODE === 'fixed') {
    payload.fixedThresholdOverride = THRESHOLD;
  }
  if (MODEL.length > 0) {
    payload.model = MODEL;
  }
  return payload;
}

function firstDefined(...values) {
  return values.find((v) => v !== undefined && v !== null);
}

function parseJsonBody(res) {
  try {
    return res.json();
  } catch {
    return null;
  }
}

function parseChatResponse(res) {
  const body = parseJsonBody(res);
  const root =
    body && typeof body === 'object' && body.data && typeof body.data === 'object'
      ? body.data
      : body || {};
  const assistant = root.assistantMessage || {};
  const cache = root.cache || {};
  const usage = assistant.usage || root.usage || {};

  const rawStatus = firstDefined(
    res.headers['X-Cache-Status'],
    res.headers['x-cache-status'],
    cache.status,
    root.cacheStatus,
  );
  const prompt = firstDefined(usage.promptTokens, usage.prompt_tokens);
  const completion = firstDefined(usage.completionTokens, usage.completion_tokens);
  let total = firstDefined(usage.totalTokens, usage.total_tokens);
  if (total === undefined && prompt !== undefined && completion !== undefined) {
    total = prompt + completion;
  }

  return {
    ok: body !== null,
    cacheStatus: rawStatus ? String(rawStatus).toUpperCase() : null,
    answer: String(firstDefined(assistant.content, root.answer, root.content, '') || ''),
    similarity: firstDefined(cache.cosineSimilarity, root.similarity),
    matchedQuery: cache.matchedQuery,
    usage: { prompt, completion, total },
  };
}

function sendMessage(dialogId, prompt, category, extraTags) {
  const res = http.post(
    `${API_BASE_URL}${DIALOGS_ENDPOINT}/${dialogId}/messages`,
    JSON.stringify(buildMessagePayload(prompt, category)),
    {
      headers: buildHeaders(AUTH_TOKEN),
      timeout: REQUEST_TIMEOUT,
      tags: Object.assign({ name: 'dialogs_send_message', cache_mode: CACHE_MODE }, extraTags),
    },
  );
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

const DOMAIN_FALLBACK_TERMS = [
  'plan',
  'tariff',
  'roam',
  'sim',
  'esim',
  'bill',
  'autopay',
  'payment',
  'refund',
  'router',
  'wi-fi',
  'wifi',
  '5g',
  'lte',
  'apn',
  'contract',
  'support',
  'тариф',
  'роумінг',
  'рахунок',
  'автоплат',
  'оплат',
  'поверн',
  'роутер',
  'контракт',
  'підтрим',
  'застосун',
  'перевір',
  'номер',
  'послуг',
];

function stripThinkBlocks(text) {
  return String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .trim();
}

function checkLanguageMatch(visibleAnswer, expectedLanguage) {
  const cyrillicMatches = visibleAnswer.match(/[а-яіїєґА-ЯІЇЄҐ]/g) || [];
  const latinMatches = visibleAnswer.match(/[a-zA-Z]/g) || [];
  if (expectedLanguage === 'uk') {
    return cyrillicMatches.length >= 3;
  }
  return latinMatches.length > cyrillicMatches.length && latinMatches.length >= 5;
}

function extractKbSalientTokens(src) {
  if (!src) return [];
  const combined = `${src.content_en || ''} ${src.content_uk || ''}`;
  const tokens = new Set();
  const numberMatches = combined.match(/[*#]?\d+(?:[.,]\d+)?%?/g) || [];
  for (const m of numberMatches) {
    if (m.length >= 1) tokens.add(m.toLowerCase());
  }
  const keywordMatches =
    combined.match(
      /\b(?:autopay|dispute|refund|pdf|roaming|eur|uah|gb|mbps|ussd|esim|sim|puk|pin|lte|5g|apn|volte|vowifi|pppoe|unlimited|hotspot|contract)\b/gi,
    ) || [];
  for (const m of keywordMatches) {
    tokens.add(m.toLowerCase());
  }
  const ukMatches =
    combined.match(
      /(?:автоплат|оскарж|поверн|роумінг|безліміт|хотспот|роздач|контракт|рахунок|пакет|знижк)/gi,
    ) || [];
  for (const m of ukMatches) {
    tokens.add(m.toLowerCase());
  }
  return [...tokens];
}

function evaluateAnswerAccuracy(item, parsed, isHit, mustMiss) {
  const visible = stripThinkBlocks(parsed.answer);
  const languageMatch = checkLanguageMatch(visible, item.language);
  const substantive = visible.length >= 20 && !/^error[:\s]/i.test(visible);

  if (isHit && mustMiss) {
    return { accurate: false, languageMatch, kbGrounded: false };
  }

  const src = kbBySourceId[item.kb_source_id];
  const kbTokens = extractKbSalientTokens(src);
  const lowerVisible = visible.toLowerCase();
  const hasKbToken = kbTokens.some((tok) => containsMarker(visible, tok));
  const hasDomainTerm = DOMAIN_FALLBACK_TERMS.some((term) => lowerVisible.includes(term));

  const isSeedOrParaphrase =
    item.query_type === 'canonical_seed' || item.query_type === 'paraphrase';
  const kbGrounded = isSeedOrParaphrase
    ? hasKbToken || hasDomainTerm
    : substantive && (hasKbToken || hasDomainTerm);

  const accurate = substantive && languageMatch && kbGrounded;
  return { accurate, languageMatch, kbGrounded };
}

function formatKbV1Content(src) {
  return `${src.content_en}\n\n${src.content_uk}`;
}

function seedKnowledgeBase(headers) {
  const listRes = http.get(`${API_BASE_URL}${KB_DOCUMENTS_ENDPOINT}`, {
    headers,
    timeout: REQUEST_TIMEOUT,
    tags: { name: 'kb_list' },
  });
  const existingDocs = listRes.status >= 200 && listRes.status < 300 ? parseJsonBody(listRes) : [];
  const bySourceId = {};
  if (Array.isArray(existingDocs)) {
    for (let i = 0; i < existingDocs.length; i += 1) {
      const doc = existingDocs[i];
      const sid = doc && doc.metadata && doc.metadata.kb_source_id;
      if (sid) bySourceId[sid] = doc;
    }
  }

  const kbSourceIdToUuid = {};
  for (let i = 0; i < kbSources.length; i += 1) {
    const src = kbSources[i];
    const existing = bySourceId[src.kb_source_id];
    if (existing) {
      kbSourceIdToUuid[src.kb_source_id] = existing.id;
      if (existing.metadata && existing.metadata.version !== src.version) {
        http.post(
          `${API_BASE_URL}${KB_DOCUMENTS_ENDPOINT}/${existing.id}/reprocess`,
          JSON.stringify({
            title: src.title,
            content: formatKbV1Content(src),
            metadata: { kb_source_id: src.kb_source_id, version: src.version },
          }),
          { headers, timeout: REQUEST_TIMEOUT, tags: { name: 'kb_restore_v1' } },
        );
      }
      continue;
    }

    const uploadRes = http.post(
      `${API_BASE_URL}${KB_DOCUMENTS_ENDPOINT}`,
      JSON.stringify({
        title: src.title,
        content: formatKbV1Content(src),
        format: 'text',
        category: mapCategory(src.category),
        metadata: { kb_source_id: src.kb_source_id, version: src.version },
      }),
      { headers, timeout: REQUEST_TIMEOUT, tags: { name: 'kb_seed_upload' } },
    );
    const uploaded = parseJsonBody(uploadRes);
    if (uploadRes.status >= 200 && uploadRes.status < 300 && uploaded && uploaded.id) {
      kbSourceIdToUuid[src.kb_source_id] = uploaded.id;
    } else {
      console.warn(
        `[semcache] failed to seed KB source ${src.kb_source_id}: HTTP ${uploadRes.status}`,
      );
    }
  }
  return kbSourceIdToUuid;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
export function setup() {
  console.log(
    `[semcache] profile=${LOAD_PROFILE} mode=${CACHE_MODE} threshold=${CACHE_MODE === 'fixed' ? THRESHOLD : 'n/a'} ` +
      `vus=${VUS} requests=${TOTAL_REQUESTS}/${dataset.length} api=${API_BASE_URL}`,
  );
  const health = http.get(`${API_BASE_URL}/health`, { timeout: '5s', tags: { name: 'health' } });
  if (health.status !== 200) {
    throw new Error(`[semcache] ${API_BASE_URL}/health returned ${health.status}`);
  }

  const adminHeaders = buildHeaders(ADMIN_TOKEN);

  if (CLEAR_CACHE_ON_START) {
    const clearRes = http.del(`${API_BASE_URL}${CACHE_CLEAR_ENDPOINT}`, null, {
      headers: adminHeaders,
      timeout: REQUEST_TIMEOUT,
      tags: { name: 'cache_clear_start' },
    });
    if (clearRes.status < 200 || clearRes.status >= 300) {
      console.warn(`[semcache] cache clear returned HTTP ${clearRes.status}`);
    }
  }

  const settingsPayload = { mode: mapMode(CACHE_MODE) };
  if (CACHE_MODE === 'fixed') {
    settingsPayload.fixedThreshold = THRESHOLD;
  }
  const settingsRes = http.patch(
    `${API_BASE_URL}${CACHE_SETTINGS_ENDPOINT}`,
    JSON.stringify(settingsPayload),
    { headers: adminHeaders, timeout: REQUEST_TIMEOUT, tags: { name: 'cache_settings_update' } },
  );
  if (settingsRes.status < 200 || settingsRes.status >= 300) {
    console.warn(`[semcache] cache settings update returned HTTP ${settingsRes.status}`);
  }

  const kbSourceIdToUuid = SEED_KB_ON_START ? seedKnowledgeBase(adminHeaders) : {};

  const dialogIds = [];
  const dialogCount = LOAD_PROFILE === 'fixed-iterations' ? VUS : Math.max(VUS, MAX_VUS);
  const userHeaders = buildHeaders(AUTH_TOKEN);
  for (let i = 0; i < dialogCount; i += 1) {
    const res = http.post(
      `${API_BASE_URL}${DIALOGS_ENDPOINT}`,
      JSON.stringify({ title: `k6 Benchmark VU ${i + 1}` }),
      { headers: userHeaders, timeout: REQUEST_TIMEOUT, tags: { name: 'dialogs_create' } },
    );
    const created = parseJsonBody(res);
    if (res.status < 200 || res.status >= 300 || !created || !created.id) {
      throw new Error(`[semcache] failed to create benchmark dialog: HTTP ${res.status}`);
    }
    dialogIds.push(created.id);
  }

  return {
    startedAt: Date.now(),
    dialogIds,
    kbSourceIdToUuid,
  };
}

export default function (data) {
  const item = dataset[exec.scenario.iterationInTest % dataset.length];
  const dialogId = data.dialogIds[(exec.vu.idInTest - 1) % data.dialogIds.length];

  const { res, parsed } = sendMessage(dialogId, item.prompt, item.category, {
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

  reqDuration.add(res.timings.duration);
  if (status === 'HIT') hitLatency.add(res.timings.duration);
  else if (status === 'MISS') missLatency.add(res.timings.duration);
  else bypassLatency.add(res.timings.duration);

  const isHit = status === 'HIT';
  const mustMiss = item.expected_behavior === 'cache_miss_required';
  hitRate.add(isHit);
  if (status === 'HIT') cacheHits.add(1);
  else if (status === 'MISS') cacheMisses.add(1);
  else cacheBypass.add(1);

  if (!mustMiss) paraphraseRecall.add(isHit);
  else missRequiredFalsePositive.add(isHit);
  if (isHit) {
    falseHitRate.add(mustMiss);
    if (mustMiss) {
      falseHits.add(1);
      if (item.query_type === 'near_duplicate_trap') trapFalseHits.add(1);
    }
  }

  const acc = evaluateAnswerAccuracy(item, parsed, isHit, mustMiss);
  answerAccuracyRate.add(acc.accurate);
  answerLanguageMatchRate.add(acc.languageMatch);
  answerKbGroundedRate.add(acc.kbGrounded);
  if (acc.accurate) answerAccurateTotal.add(1);
  else answerInaccurateTotal.add(1);

  if (isHit) {
    const saved =
      observedTokenCount > 0
        ? Math.round(observedTokenSum / observedTokenCount)
        : BASELINE_TOKENS_PER_REQ;
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
 * Post-load KB invalidation check: for each scenario, reprocess the KB document with updated v2
 * content (which triggers automatic cache.invalidate.bySources), re-send affected queries, and
 * verify none is served from a stale cache entry.
 */
export function teardown(data) {
  loadPhaseDuration.add((Date.now() - data.startedAt) / 1000);
  if (!RUN_KB_INVALIDATION) {
    console.log('[semcache] KB invalidation phase skipped (RUN_KB_INVALIDATION=false)');
    return;
  }

  const adminHeaders = buildHeaders(ADMIN_TOKEN);
  const dialogId = data.dialogIds[0];
  const updatedSourceIds = [];

  const hasPerSourceSeeds = Object.keys(data.kbSourceIdToUuid || {}).length > 0;
  if (!hasPerSourceSeeds) {
    // User uploaded their own KB (e.g. docs/telecom-knowledge-base.md); pick the first ready
    // document, reprocess it with an updated policy fact, verify cache invalidation, and restore.
    const listRes = http.get(`${API_BASE_URL}${KB_DOCUMENTS_ENDPOINT}`, {
      headers: adminHeaders,
      timeout: REQUEST_TIMEOUT,
      tags: { name: 'kb_list_teardown' },
    });
    const docs = listRes.status >= 200 && listRes.status < 300 ? parseJsonBody(listRes) : [];
    const targetDoc = Array.isArray(docs)
      ? docs.find((d) => d.status === 'ready') || docs[0]
      : null;
    if (!targetDoc || !targetDoc.id) {
      console.warn('[semcache] skipping KB invalidation: no uploaded KB document found');
      return;
    }

    const detailRes = http.get(`${API_BASE_URL}${KB_DOCUMENTS_ENDPOINT}/${targetDoc.id}`, {
      headers: adminHeaders,
      timeout: REQUEST_TIMEOUT,
      tags: { name: 'kb_get_teardown' },
    });
    const detail =
      detailRes.status >= 200 && detailRes.status < 300 ? parseJsonBody(detailRes) : null;
    const originalContent = detail && detail.content ? String(detail.content) : null;
    if (!originalContent) {
      console.warn('[semcache] skipping KB invalidation: unable to read document content');
      return;
    }

    const updatedContent = originalContent
      .replace(/€2 monthly discount/gi, '€4 monthly discount')
      .replace(/save €2 per month/gi, 'save €4 per month');
    const updateRes = http.post(
      `${API_BASE_URL}${KB_DOCUMENTS_ENDPOINT}/${targetDoc.id}/reprocess`,
      JSON.stringify({ content: updatedContent }),
      {
        headers: adminHeaders,
        timeout: REQUEST_TIMEOUT,
        tags: { name: 'kb_source_update', scenario: 'user-kb-autopay-update' },
      },
    );
    const updated = updateRes.status >= 200 && updateRes.status < 300;
    kbUpdates.add(1);
    kbUpdateSuccess.add(updated);
    check(updateRes, { 'KB source reprocess is 2xx': () => updated });
    if (updated) {
      if (KB_PROPAGATION_MS > 0) sleep(KB_PROPAGATION_MS / 1000);
      const autopayQueries = [
        'How do I turn on autopay for my mobile plan?',
        'Як підключити автоплатіж за мій тариф?',
      ];
      autopayQueries.forEach((prompt, i) => {
        const { res, parsed } = sendMessage(dialogId, prompt, 'billing', {
          phase: 'kb_invalidation',
          scenario: 'user-kb-autopay-update',
        });
        kbChecks.add(1);
        kbInvalidationLatency.add(res.timings.duration);
        const notHit = parsed.cacheStatus !== 'HIT';
        const stale = containsMarker(parsed.answer, '€2') && !containsMarker(parsed.answer, '€4');
        kbInvalidationMiss.add(notHit);
        kbStalePrevented.add(notHit && !stale);
        if (i === 0 && CACHE_MODE !== 'no-cache') {
          const again = sendMessage(dialogId, prompt, 'billing', {
            phase: 'kb_reverify',
            scenario: 'user-kb-autopay-update',
          });
          kbReverifyHit.add(again.parsed.cacheStatus === 'HIT');
        }
      });

      const probe = sendMessage(
        dialogId,
        'What is the monthly AutoPay discount on postpaid plans?',
        'billing',
        { phase: 'kb_probe', scenario: 'user-kb-autopay-update' },
      );
      kbFreshFact.add(containsMarker(probe.parsed.answer, '€4'));

      if (RESTORE_KB_AFTER_TEST) {
        http.post(
          `${API_BASE_URL}${KB_DOCUMENTS_ENDPOINT}/${targetDoc.id}/reprocess`,
          JSON.stringify({ content: originalContent }),
          {
            headers: adminHeaders,
            timeout: REQUEST_TIMEOUT,
            tags: { name: 'kb_restore_original' },
          },
        );
      }
    }
    return;
  }

  for (let s = 0; s < scenarios.length; s += 1) {
    const scenario = scenarios[s];
    const docId = data.kbSourceIdToUuid[scenario.kb_source_id];
    if (!docId) {
      console.warn(`[semcache] skipping ${scenario.scenario_id}: KB document UUID not found`);
      continue;
    }

    const update = http.post(
      `${API_BASE_URL}${KB_DOCUMENTS_ENDPOINT}/${docId}/reprocess`,
      JSON.stringify({
        title: scenario.update_payload.title,
        content: scenario.update_payload.content,
        metadata: {
          kb_source_id: scenario.kb_source_id,
          version: scenario.update_payload.version,
        },
      }),
      {
        headers: adminHeaders,
        timeout: REQUEST_TIMEOUT,
        tags: { name: 'kb_source_update', scenario: scenario.scenario_id },
      },
    );
    const updated = update.status >= 200 && update.status < 300;
    kbUpdates.add(1);
    kbUpdateSuccess.add(updated);
    check(update, { 'KB source reprocess is 2xx': () => updated });
    if (!updated) {
      console.error(
        `[semcache] KB reprocess ${scenario.kb_source_id} failed: HTTP ${update.status}`,
      );
      continue;
    }
    updatedSourceIds.push(scenario.kb_source_id);
    if (KB_PROPAGATION_MS > 0) sleep(KB_PROPAGATION_MS / 1000);

    scenario.verification_queries.forEach((query, i) => {
      const { res, parsed } = sendMessage(dialogId, query.prompt, scenario.category, {
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

      if (i === 0 && CACHE_MODE !== 'no-cache') {
        const again = sendMessage(dialogId, query.prompt, scenario.category, {
          phase: 'kb_reverify',
          scenario: scenario.scenario_id,
        });
        kbReverifyHit.add(again.parsed.cacheStatus === 'HIT');
      }
    });

    scenario.fact_probe_queries.forEach((probe) => {
      const { parsed } = sendMessage(dialogId, probe.prompt, scenario.category, {
        phase: 'kb_probe',
        scenario: scenario.scenario_id,
      });
      kbFreshFact.add(anyMarker(parsed.answer, scenario.fresh_markers));
    });
  }

  if (RESTORE_KB_AFTER_TEST && updatedSourceIds.length > 0) {
    for (let i = 0; i < updatedSourceIds.length; i += 1) {
      const sid = updatedSourceIds[i];
      const src = kbSources.find((k) => k.kb_source_id === sid);
      const docId = data.kbSourceIdToUuid[sid];
      if (!src || !docId) continue;
      http.post(
        `${API_BASE_URL}${KB_DOCUMENTS_ENDPOINT}/${docId}/reprocess`,
        JSON.stringify({
          title: src.title,
          content: formatKbV1Content(src),
          metadata: { kb_source_id: src.kb_source_id, version: src.version },
        }),
        { headers: adminHeaders, timeout: REQUEST_TIMEOUT, tags: { name: 'kb_restore_v1' } },
      );
    }
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
      load_profile: LOAD_PROFILE,
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
    accuracy: {
      overall_accuracy: rate('answer_accuracy_rate'),
      accurate_count: count('answer_accurate_total'),
      inaccurate_count: count('answer_inaccurate_total'),
      language_match_rate: rate('answer_language_match_rate'),
      kb_grounded_rate: rate('answer_kb_grounded_rate'),
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
    `accuracy: overall=${pct(report.accuracy.overall_accuracy)}  lang_match=${pct(report.accuracy.language_match_rate)}  ` +
      `kb_grounded=${pct(report.accuracy.kb_grounded_rate)}  (${report.accuracy.accurate_count}/${requests})`,
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
