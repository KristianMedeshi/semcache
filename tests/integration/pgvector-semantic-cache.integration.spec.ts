import { randomUUID } from 'node:crypto';
import { CacheHitStatus, CacheMode, QueryCategory } from '@semcache/shared-types';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../apps/semantic-cache-service/src/db/schema';
import { SemanticCacheRepository } from '../../apps/semantic-cache-service/src/semantic-cache/semantic-cache.repository';
import { SemanticCacheService } from '../../apps/semantic-cache-service/src/semantic-cache/semantic-cache.service';
import { ThresholdCalculatorService } from '../../apps/semantic-cache-service/src/semantic-cache/threshold-calculator.service';
import { loadIntegrationDatabaseUrl, makeUnitVector384 } from './test-db.helper';

describe('pgvector Semantic Cache Integration (Real PostgreSQL)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let repository: SemanticCacheRepository;
  let service: SemanticCacheService;
  const testRunId = `int-sc-${randomUUID()}`;
  const createdEntryIds: string[] = [];
  let originalSettings: Awaited<ReturnType<SemanticCacheService['getSettings']>> | null = null;

  beforeAll(async () => {
    pool = new Pool({ connectionString: loadIntegrationDatabaseUrl('apps/semantic-cache-service') });
    db = drizzle(pool, { schema });
    repository = new SemanticCacheRepository(db);
    service = new SemanticCacheService(repository, new ThresholdCalculatorService());
    originalSettings = await service.getSettings();
  });

  afterAll(async () => {
    if (db && createdEntryIds.length > 0) {
      await db
        .delete(schema.semanticCacheEntries)
        .where(
          sql`${schema.semanticCacheEntries.metadata}->>'testRunId' = ${testRunId}`,
        );
    }
    if (service && originalSettings) {
      await service.updateSettings({
        mode: originalSettings.mode,
        fixedThreshold: originalSettings.fixedThreshold,
        adaptiveBaseThreshold: originalSettings.adaptiveBaseThreshold,
        minAdaptiveThreshold: originalSettings.minAdaptiveThreshold,
        maxAdaptiveThreshold: originalSettings.maxAdaptiveThreshold,
        densityWeight: originalSettings.densityWeight,
        densityKNeighbors: originalSettings.densityKNeighbors,
        categoryWeights: originalSettings.categoryWeights,
      });
    }
    if (pool) {
      await pool.end();
    }
  });

  it('verifies pgvector extension and HNSW cosine index exist in PostgreSQL', async () => {
    const extResult = await pool.query<{ extname: string }>(
      "SELECT extname FROM pg_extension WHERE extname = 'vector'",
    );
    expect(extResult.rows).toHaveLength(1);

    const idxResult = await pool.query<{ indexname: string; indexdef: string }>(
      "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'semantic_cache_entries' AND indexdef ILIKE '%hnsw%'",
    );
    expect(idxResult.rows.length).toBeGreaterThanOrEqual(1);
    expect(idxResult.rows[0]?.indexdef).toContain('vector_cosine_ops');
  });

  it('stores entries with source bindings and performs real pgvector cosine fixed-threshold lookup', async () => {
    const docId = randomUUID();
    const baseVec = makeUnitVector384(10);
    // cos(theta) = 1 / sqrt(1 + 0.3^2) = 0.9578 >= 0.90 (HIT)
    const closeVec = makeUnitVector384(10, 11, 0.3);
    // cos(theta) = 1 / sqrt(1 + 0.6^2) = 0.8575 < 0.90 (MISS)
    const farVec = makeUnitVector384(10, 11, 0.6);

    const stored = await service.store({
      query: `[${testRunId}] How do I enable autopay?`,
      response: 'Open Payments > Autopay in the app.',
      embedding: baseVec,
      category: QueryCategory.BILLING,
      knowledgeSourceIds: [docId],
      metadata: { testRunId },
    });
    createdEntryIds.push(stored.id);
    expect(stored.knowledgeSourceIds).toEqual([docId]);

    const hit = await service.lookup({
      query: 'How can I turn on autopay?',
      embedding: closeVec,
      category: QueryCategory.BILLING,
      mode: CacheMode.FIXED,
      fixedThresholdOverride: 0.9,
    });
    expect(hit.status).toBe(CacheHitStatus.HIT);
    expect(hit.entryId).toBe(stored.id);
    expect(hit.evaluation.cosineSimilarity).toBeCloseTo(0.9578, 3);
    expect(hit.knowledgeSourceIds).toEqual([docId]);

    const miss = await service.lookup({
      query: 'Unrelated billing question',
      embedding: farVec,
      category: QueryCategory.BILLING,
      mode: CacheMode.FIXED,
      fixedThresholdOverride: 0.9,
    });
    expect(miss.status).toBe(CacheHitStatus.MISS);
    expect(miss.evaluation.cosineSimilarity).toBeCloseTo(0.8575, 3);
  });

  it('computes adaptive threshold from real pgvector neighbor cluster density and category weights', async () => {
    // Store 4 tightly clustered entries in PRODUCT_INQUIRY (dimensions 50..53)
    const clusterCenter = makeUnitVector384(50);
    for (let i = 0; i < 4; i += 1) {
      const entry = await service.store({
        query: `[${testRunId}] Roaming pack variant ${i}`,
        response: `Roaming pack answer ${i}`,
        embedding: makeUnitVector384(50, 51 + i, 0.05),
        category: QueryCategory.PRODUCT_INQUIRY,
        metadata: { testRunId },
      });
      createdEntryIds.push(entry.id);
    }

    const denseResult = await service.lookup({
      query: 'Tell me about travel roaming packs',
      embedding: clusterCenter,
      category: QueryCategory.PRODUCT_INQUIRY,
      mode: CacheMode.ADAPTIVE,
    });

    expect(denseResult.status).toBe(CacheHitStatus.HIT);
    expect(denseResult.evaluation.neighborCount).toBeGreaterThanOrEqual(4);
    expect(denseResult.evaluation.localClusterDensity).toBeGreaterThan(0.5);
    expect(denseResult.evaluation.adaptiveThreshold).toBeGreaterThan(0.83);
  });

  it('invalidates only entries linked to a specific documentId via semantic_cache_entry_sources', async () => {
    const targetDocId = randomUUID();
    const keepDocId = randomUUID();

    const targetEntry = await service.store({
      query: `[${testRunId}] Target doc query`,
      response: 'Target response',
      embedding: makeUnitVector384(80),
      category: QueryCategory.GENERAL,
      knowledgeSourceIds: [targetDocId],
      metadata: { testRunId },
    });
    createdEntryIds.push(targetEntry.id);

    const keepEntry = await service.store({
      query: `[${testRunId}] Keep doc query`,
      response: 'Keep response',
      embedding: makeUnitVector384(85),
      category: QueryCategory.GENERAL,
      knowledgeSourceIds: [keepDocId],
      metadata: { testRunId },
    });
    createdEntryIds.push(keepEntry.id);

    const inv = await service.invalidateBySources([targetDocId]);
    expect(inv.invalidatedCount).toBe(1);

    const targetLookup = await service.lookup({
      query: 'Target doc query',
      embedding: makeUnitVector384(80),
      category: QueryCategory.GENERAL,
      mode: CacheMode.FIXED,
      fixedThresholdOverride: 0.9,
    });
    expect(targetLookup.status).toBe(CacheHitStatus.MISS);

    const keepLookup = await service.lookup({
      query: 'Keep doc query',
      embedding: makeUnitVector384(85),
      category: QueryCategory.GENERAL,
      mode: CacheMode.FIXED,
      fixedThresholdOverride: 0.9,
    });
    expect(keepLookup.status).toBe(CacheHitStatus.HIT);
    expect(keepLookup.entryId).toBe(keepEntry.id);
  });
});
