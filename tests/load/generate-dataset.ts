/**
 * Deterministic generator for the SemCache telecom benchmark dataset.
 *
 * Outputs (default: <repo>/datasets/labeled):
 *   - dataset_2000.jsonl  2,000 labeled customer-support requests (UK/EN)
 *   - kb_updates.json     KB source catalog + post-load invalidation scenarios
 *
 * Usage (Node >= 22.18 / 24 runs TypeScript natively, no extra tooling):
 *   node tests/load/generate-dataset.ts [--seed 20260501] [--out-dir datasets/labeled]
 *
 * Determinism: all randomness comes from a seeded mulberry32 PRNG; no clock or Math.random.
 * Re-running with the same seed yields byte-identical files.
 *
 * Composition (2,000 records):
 *   84   canonical seeds        first occurrence of an intent per language  -> cache_miss_required
 *   1332 paraphrases            repeats of a seeded intent (66.6%)          -> cache_hit_ok
 *   168  near-duplicate traps   same wording, different critical condition  -> cache_miss_required
 *   416  unique edge queries    new/rare issues                             -> cache_miss_required
 *
 * Ordering guarantee: every paraphrase/trap appears >= MIN_GAP positions after the canonical seed
 * of the (intent, language) it depends on, so a correct cache can legitimately have the entry.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { CATEGORIES, EDGE_TEMPLATES, INTENTS, KB_SOURCES, SCENARIOS } from './dataset-content.ts';
import type { ClusterDensity, IntentDef, Language, TelecomCategory } from './dataset-content.ts';

type ExpectedBehavior = 'cache_hit_ok' | 'cache_miss_required';
type QueryType = 'canonical_seed' | 'paraphrase' | 'near_duplicate_trap' | 'unique_edge';

interface DatasetRecord {
  id: string;
  language: Language;
  category: TelecomCategory;
  intent_id: string;
  cluster_density: ClusterDensity;
  kb_source_id: string;
  is_paraphrase_of_existing: boolean;
  expected_behavior: ExpectedBehavior;
  prompt: string;
  query_type: QueryType;
  trap_of_intent_id: string | null;
  trap_reason: string | null;
}

/** A record before final ordering; `depKey` is the `intent|lang` seed it must come after. */
interface Draft {
  record: Omit<DatasetRecord, 'id'>;
  depKey: string | null;
}

const TOTAL = 2000;
const MIN_GAP = 20;
const SEED_WINDOW = 300;
const DATASET_FILE = 'dataset_2000.jsonl';
const LANGUAGES: readonly Language[] = ['en', 'uk'];

// ---------------------------------------------------------------------------
// CLI + PRNG
// ---------------------------------------------------------------------------
function parseArgs(argv: string[]): { seed: number; outDir: string } {
  const scriptPath = process.argv[1] ?? '';
  const repoRoot = resolve(dirname(scriptPath), '..', '..');
  let seed = 20260501;
  let outDir = join(repoRoot, 'datasets', 'labeled');
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--seed' && next !== undefined) {
      seed = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === '--out-dir' && next !== undefined) {
      outDir = resolve(next);
      i += 1;
    }
  }
  if (!Number.isInteger(seed)) throw new Error('--seed must be an integer');
  return { seed, outDir };
}

function createRandom(seed: number) {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
  const chance = (p: number): boolean => next() < p;
  const pick = <T>(items: readonly T[]): T => {
    const item = items[int(0, items.length - 1)];
    if (item === undefined) throw new Error('pick() on empty array');
    return item;
  };
  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  };
  return { next, int, chance, pick, shuffle };
}
type Random = ReturnType<typeof createRandom>;

// ---------------------------------------------------------------------------
// Surface realization: conversational wrappers + realistic noise
// ---------------------------------------------------------------------------
const WRAPPERS: Record<Language, { prefix: string[]; suffix: string[]; context: string[] }> = {
  en: {
    prefix: [
      '',
      '',
      '',
      'Hi, ',
      'Hello! ',
      'Good afternoon, ',
      'Hey, ',
      'Quick question: ',
      'Sorry to bother you, ',
      'Please help: ',
      'Excuse me, ',
    ],
    suffix: [
      '',
      '',
      '',
      ' Thanks!',
      ' Thank you in advance.',
      " It's urgent.",
      ' Any help appreciated.',
      ' Please advise.',
      ' Thx',
    ],
    context: [
      '',
      '',
      '',
      '',
      " I'm a long-time customer.",
      " I'm writing from my phone.",
      " I'm in Kharkiv.",
      " I'm in Lviv.",
      " I'm in Kyiv.",
      ' I tried the app already.',
    ],
  },
  uk: {
    prefix: [
      '',
      '',
      '',
      'Добрий день, ',
      'Привіт! ',
      'Вітаю! ',
      'Підкажіть, будь ласка, ',
      'Допоможіть, ',
      'Слухайте, ',
      'Перепрошую, ',
      'Є питання: ',
    ],
    suffix: [
      '',
      '',
      '',
      ' Дякую!',
      ' Заздалегідь дякую.',
      ' Це терміново.',
      ' Буду вдячний за допомогу.',
      ' Чекаю на відповідь.',
      ' Дякс',
    ],
    context: [
      '',
      '',
      '',
      '',
      ' Я давній клієнт.',
      ' Пишу з телефону.',
      ' Я з Харкова.',
      ' Я зі Львова.',
      ' Я з Києва.',
      ' Вже пробував через застосунок.',
    ],
  },
};

const ABBREVIATIONS: Record<Language, Array<[RegExp, string]>> = {
  en: [
    [/please/i, 'pls'],
    [/thank you/i, 'thx'],
    [/\byou\b/, 'u'],
    [/because/i, 'bc'],
    [/what is/i, 'whats'],
  ],
  uk: [
    [/будь ласка/i, 'плз'],
    [/дякую/i, 'дяк'],
    [/будь-ласка/i, 'плз'],
    [/чому/i, 'чого'],
    [/заздалегідь/i, 'заздалегіть'],
  ],
};

const FIRST_WORD = /^([A-ZА-ЯІЇЄҐ][a-zа-яіїєґ']+)\b/u;

function lowercaseFirst(text: string): string {
  const match = FIRST_WORD.exec(text);
  if (!match || match[1] === 'I') return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function applyTypo(text: string, rnd: Random): string {
  const words = text.split(' ');
  const candidates = words.map((w, i) => (/^\p{L}{5,}$/u.test(w) ? i : -1)).filter((i) => i >= 0);
  if (candidates.length === 0) return text;
  const index = rnd.pick(candidates);
  const chars = [...(words[index] as string)];
  if (rnd.chance(0.5)) {
    const pos = rnd.int(1, chars.length - 3);
    [chars[pos], chars[pos + 1]] = [chars[pos + 1] as string, chars[pos] as string];
  } else {
    chars.splice(rnd.int(1, chars.length - 2), 1);
  }
  words[index] = chars.join('');
  return words.join(' ');
}

/** Builds one prompt surface; `noise` in [0,1] scales typo/casual-style probability. */
function decorate(core: string, language: Language, noise: number, rnd: Random): string {
  const w = WRAPPERS[language];
  const prefix = rnd.pick(w.prefix);
  const suffix = rnd.pick(w.suffix);
  const context = rnd.pick(w.context);
  const body = /[,:]\s$/.test(prefix) ? lowercaseFirst(core) : core;
  let text = `${prefix}${body}${context}${suffix}`;

  if (rnd.chance(0.3 * noise)) {
    for (const [pattern, replacement] of ABBREVIATIONS[language]) {
      if (pattern.test(text) && rnd.chance(0.5)) text = text.replace(pattern, replacement);
    }
  }
  if (rnd.chance(0.35 * noise)) text = applyTypo(text, rnd);
  if (rnd.chance(0.12 * noise)) text = text.replace(/[?.!]\s*$/, '');
  if (rnd.chance(0.12 * noise)) text = lowercaseFirst(text);
  return text.trim();
}

/** Generates a prompt that has not been emitted before (best effort, bounded retries). */
function uniquePrompt(
  core: string,
  language: Language,
  noise: number,
  rnd: Random,
  used: Set<string>,
): string {
  let candidate = decorate(core, language, noise, rnd);
  for (let attempt = 0; attempt < 80 && used.has(candidate.toLowerCase()); attempt += 1) {
    candidate = decorate(core, language, noise, rnd);
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

// ---------------------------------------------------------------------------
// Draft construction
// ---------------------------------------------------------------------------
function kbSourceId(category: TelecomCategory, sourceIdx: number): string {
  const source = KB_SOURCES.filter((s) => s.category === category)[sourceIdx];
  if (!source) throw new Error(`Missing KB source ${category}[${sourceIdx}]`);
  return source.id;
}

const keyOf = (intentId: string, language: Language): string => `${intentId}|${language}`;

/** 28 paraphrases per (intent, language) for high density (+1 for 8 intents), 14 medium, 5 low. */
function paraphraseCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  const highIntents = INTENTS.filter((i) => i.density === 'high');
  INTENTS.forEach((intent) => {
    let count = intent.density === 'high' ? 28 : intent.density === 'medium' ? 14 : 5;
    if (intent.density === 'high' && highIntents.indexOf(intent) < 8) count += 1;
    counts.set(intent.id, count);
  });
  return counts;
}

function buildDrafts(rnd: Random): Draft[] {
  const used = new Set<string>();
  const seeds: Draft[] = [];
  const dependents: Draft[] = [];
  const edges: Draft[] = [];
  const counts = paraphraseCounts();

  // Seeds first so their verbatim canonical prompts are reserved in the uniqueness set.
  for (const intent of INTENTS) {
    for (const language of LANGUAGES) {
      const prompt = intent[language][0] as string;
      used.add(prompt.toLowerCase());
      seeds.push({
        depKey: null,
        record: baseRecord(
          intent,
          language,
          prompt,
          'canonical_seed',
          false,
          'cache_miss_required',
        ),
      });
    }
  }

  for (const intent of INTENTS) {
    for (const language of LANGUAGES) {
      const phrasings = intent[language];
      const key = keyOf(intent.id, language);
      for (let n = 0; n < (counts.get(intent.id) as number); n += 1) {
        const prompt = uniquePrompt(rnd.pick(phrasings), language, 1, rnd, used);
        dependents.push({
          depKey: key,
          record: baseRecord(intent, language, prompt, 'paraphrase', true, 'cache_hit_ok'),
        });
      }
      intent.traps.forEach((trap, trapIdx) => {
        const prompt = uniquePrompt(trap[language], language, 0.5, rnd, used);
        dependents.push({
          depKey: key,
          record: {
            ...baseRecord(
              intent,
              language,
              prompt,
              'near_duplicate_trap',
              false,
              'cache_miss_required',
            ),
            intent_id: `trap_${intent.id}_${trapIdx + 1}`,
            trap_of_intent_id: intent.id,
            trap_reason: trap.reason,
          },
        });
      });
    }
  }

  for (const template of EDGE_TEMPLATES) {
    for (const language of LANGUAGES) {
      template.slots.forEach((slot, slotIdx) => {
        const langIdx = language === 'en' ? 0 : 1;
        const core = template[language].replace('{x}', slot[langIdx]);
        edges.push({
          depKey: null,
          record: {
            language,
            category: template.category,
            intent_id: `edge_${template.id}_${slotIdx + 1}`,
            cluster_density: template.density,
            kb_source_id: kbSourceId(template.category, template.sourceIdx),
            is_paraphrase_of_existing: false,
            expected_behavior: 'cache_miss_required',
            prompt: uniquePrompt(core, language, 0.6, rnd, used),
            query_type: 'unique_edge',
            trap_of_intent_id: null,
            trap_reason: null,
          },
        });
      });
    }
  }

  return [...seeds, ...dependents, ...edges];
}

function baseRecord(
  intent: IntentDef,
  language: Language,
  prompt: string,
  queryType: QueryType,
  isParaphrase: boolean,
  expected: ExpectedBehavior,
): Omit<DatasetRecord, 'id'> {
  return {
    language,
    category: intent.category,
    intent_id: intent.id,
    cluster_density: intent.density,
    kb_source_id: kbSourceId(intent.category, intent.sourceIdx),
    is_paraphrase_of_existing: isParaphrase,
    expected_behavior: expected,
    prompt,
    query_type: queryType,
    trap_of_intent_id: null,
    trap_reason: null,
  };
}

// ---------------------------------------------------------------------------
// Ordering: seeds early, dependents never closer than MIN_GAP to their seed
// ---------------------------------------------------------------------------
function orderDrafts(drafts: Draft[], rnd: Random): DatasetRecord[] {
  const seeds = drafts.filter((d) => d.record.query_type === 'canonical_seed');
  const others = rnd.shuffle(drafts.filter((d) => d.record.query_type !== 'canonical_seed'));
  const seedSlots = rnd
    .shuffle(Array.from({ length: SEED_WINDOW }, (_, i) => i))
    .slice(0, seeds.length)
    .sort((a, b) => a - b);

  const slotSeed = new Map<number, Draft>();
  const seedPos = new Map<string, number>();
  rnd.shuffle(seeds).forEach((seed, i) => {
    const slot = seedSlots[i] as number;
    slotSeed.set(slot, seed);
    seedPos.set(keyOf(seed.record.intent_id, seed.record.language), slot);
  });

  const ordered: Draft[] = [];
  for (let position = 0; position < drafts.length; position += 1) {
    const seed = slotSeed.get(position);
    if (seed) {
      ordered.push(seed);
      continue;
    }
    const idx = others.findIndex(
      (d) => d.depKey === null || position >= (seedPos.get(d.depKey) as number) + MIN_GAP,
    );
    if (idx < 0) throw new Error(`No eligible record for position ${position}`);
    ordered.push(others.splice(idx, 1)[0] as Draft);
  }

  return ordered.map((d, i) => ({ id: `req-${String(i + 1).padStart(4, '0')}`, ...d.record }));
}

// ---------------------------------------------------------------------------
// kb_updates.json
// ---------------------------------------------------------------------------
function buildKbUpdates(records: DatasetRecord[], seed: number) {
  const scenarios = SCENARIOS.map((s) => {
    const source = KB_SOURCES.find((k) => k.id === s.kbSourceId);
    if (!source) throw new Error(`Unknown KB source ${s.kbSourceId}`);
    const verification = LANGUAGES.flatMap((language) => {
      const forIntent = records.filter(
        (r) => r.intent_id === s.intentId && r.language === language,
      );
      const picked = [
        forIntent.find((r) => r.query_type === 'canonical_seed'),
        forIntent.find((r) => r.query_type === 'paraphrase'),
      ];
      return picked.map((r) => {
        if (!r) throw new Error(`No verification record for ${s.intentId}/${language}`);
        return {
          record_id: r.id,
          intent_id: r.intent_id,
          language: r.language,
          query_type: r.query_type,
          prompt: r.prompt,
        };
      });
    });
    return {
      scenario_id: s.id,
      kb_source_id: s.kbSourceId,
      title: s.title,
      category: source.category,
      intent_id: s.intentId,
      previous_fact: s.previousFact,
      updated_fact: s.updatedFact,
      stale_markers: s.staleMarkers,
      fresh_markers: s.freshMarkers,
      update_payload: {
        title: source.title,
        category: source.category,
        version: s.newVersion,
        content: `${s.newContentEn}\n\n${s.newContentUk}`,
        summary: s.newSummary,
        invalidateCache: true,
        changeReason: s.changeReason,
      },
      verification_queries: verification,
      fact_probe_queries: [
        { language: 'en', prompt: s.probes.en },
        { language: 'uk', prompt: s.probes.uk },
      ],
    };
  });

  return {
    metadata: {
      schema_version: 1,
      generator: 'tests/load/generate-dataset.ts',
      seed,
      dataset_file: DATASET_FILE,
      total_dataset_records: records.length,
      total_kb_sources: KB_SOURCES.length,
      total_invalidation_scenarios: scenarios.length,
    },
    kb_sources: KB_SOURCES.map((s) => ({
      kb_source_id: s.id,
      title: s.title,
      category: s.category,
      version: 'v1',
      summary: s.summary,
      content_en: s.contentEn,
      content_uk: s.contentUk,
    })),
    invalidation_scenarios: scenarios,
  };
}

// ---------------------------------------------------------------------------
// Self-validation
// ---------------------------------------------------------------------------
function validate(records: DatasetRecord[], kb: ReturnType<typeof buildKbUpdates>): void {
  const errors: string[] = [];
  const check = (condition: boolean, message: string): void => {
    if (!condition) errors.push(message);
  };

  for (const intent of INTENTS) {
    check(intent.en.length === 4 && intent.uk.length === 4, `${intent.id}: need 4+4 phrasings`);
    check(intent.traps.length === 2, `${intent.id}: need 2 traps`);
  }
  for (const t of EDGE_TEMPLATES) check(t.slots.length === 8, `${t.id}: need 8 slots`);
  check(INTENTS.length === 42, 'expected 42 intents');
  check(KB_SOURCES.length === 21, 'expected 21 KB sources');

  check(records.length === TOTAL, `expected ${TOTAL} records, got ${records.length}`);
  check(
    records.every((r, i) => r.id === `req-${String(i + 1).padStart(4, '0')}`),
    'ids must be sequential',
  );
  check(
    CATEGORIES.every((c) => records.some((r) => r.category === c)),
    'all 7 categories must appear',
  );
  check(
    LANGUAGES.every((l) => records.some((r) => r.language === l)),
    'both languages must appear',
  );

  const paraphraseShare = records.filter((r) => r.is_paraphrase_of_existing).length / TOTAL;
  const missShare =
    records.filter((r) => r.expected_behavior === 'cache_miss_required').length / TOTAL;
  check(paraphraseShare >= 0.65 && paraphraseShare <= 0.7, `paraphrase share ${paraphraseShare}`);
  check(missShare >= 0.3 && missShare <= 0.35, `miss-required share ${missShare}`);

  const firstSeed = new Map<string, number>();
  records.forEach((r, i) => {
    if (r.query_type === 'canonical_seed') firstSeed.set(keyOf(r.intent_id, r.language), i);
  });
  records.forEach((r, i) => {
    if (r.query_type !== 'paraphrase' && r.query_type !== 'near_duplicate_trap') return;
    const base = r.query_type === 'paraphrase' ? r.intent_id : (r.trap_of_intent_id as string);
    const seedIndex = firstSeed.get(keyOf(base, r.language));
    check(seedIndex !== undefined && i - seedIndex >= MIN_GAP, `${r.id}: seed gap < ${MIN_GAP}`);
  });

  const kbIds = new Set(kb.kb_sources.map((s) => s.kb_source_id));
  check(
    records.every((r) => kbIds.has(r.kb_source_id)),
    'every kb_source_id must exist in kb_updates.json',
  );

  const uniqueRatio = new Set(records.map((r) => r.prompt.toLowerCase())).size / TOTAL;
  check(uniqueRatio >= 0.95, `unique prompt ratio ${uniqueRatio.toFixed(3)} < 0.95`);

  if (errors.length > 0) {
    throw new Error(`Dataset validation failed:\n - ${errors.join('\n - ')}`);
  }
}

function summarize(records: DatasetRecord[]): void {
  const count = <K extends string>(pick: (r: DatasetRecord) => K): string =>
    Object.entries(
      records.reduce<Record<string, number>>((acc, r) => {
        const key = pick(r);
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .map(([k, v]) => `${k}=${v}`)
      .join('  ');
  const pct = (n: number): string => `${((n / records.length) * 100).toFixed(1)}%`;
  const hits = records.filter((r) => r.expected_behavior === 'cache_hit_ok').length;
  console.log(`records           : ${records.length}`);
  console.log(`cache_hit_ok      : ${hits} (${pct(hits)})`);
  console.log(`cache_miss_req.   : ${records.length - hits} (${pct(records.length - hits)})`);
  console.log(`query_type        : ${count((r) => r.query_type)}`);
  console.log(`language          : ${count((r) => r.language)}`);
  console.log(`category          : ${count((r) => r.category)}`);
  console.log(`cluster_density   : ${count((r) => r.cluster_density)}`);
  const unique = new Set(records.map((r) => r.prompt.toLowerCase())).size;
  console.log(`unique prompts    : ${unique} (${pct(unique)})`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main(): void {
  const { seed, outDir } = parseArgs(process.argv.slice(2));
  const rnd = createRandom(seed);
  const records = orderDrafts(buildDrafts(rnd), rnd);
  const kb = buildKbUpdates(records, seed);
  validate(records, kb);

  mkdirSync(outDir, { recursive: true });
  const datasetPath = join(outDir, DATASET_FILE);
  const kbPath = join(outDir, 'kb_updates.json');
  writeFileSync(datasetPath, `${records.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf8');
  writeFileSync(kbPath, `${JSON.stringify(kb, null, 2)}\n`, 'utf8');

  summarize(records);
  console.log(`wrote ${datasetPath}`);
  console.log(`wrote ${kbPath}`);
}

main();
