import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS,
  type CacheKnowledgeSourceReferenceDto,
} from '@semcache/shared-dtos';
import { CacheHitStatus, CacheMode, QueryCategory } from '@semcache/shared-types';
import type { SemanticCacheEntryRecord, SemanticCacheSettingsRecord } from '../db/schema';
import type { DefaultSettingsSeed, SemanticCacheRepository } from './semantic-cache.repository';
import { SemanticCacheService } from './semantic-cache.service';
import { ThresholdCalculatorService } from './threshold-calculator.service';

function makeUnitVector(seed: number): number[] {
  const vec = Array.from({ length: 384 }, (_, idx) => (idx === seed % 384 ? 1 : 0.01));
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map((v) => v / norm);
}

function cosineSim(a: number[], b: number[]): number {
  return a.reduce((sum, v, idx) => sum + v * (b[idx] ?? 0), 0);
}

function createServiceHarness() {
  const entries = new Map<string, SemanticCacheEntryRecord>();
  const sourcesByEntry = new Map<string, CacheKnowledgeSourceReferenceDto[]>();
  let settingsRecord: SemanticCacheSettingsRecord | null = null;

  const ensureSettings = (defaults: DefaultSettingsSeed): SemanticCacheSettingsRecord => {
    if (!settingsRecord) {
      const now = new Date();
      settingsRecord = {
        id: 'default',
        mode: defaults.mode,
        fixedThreshold: defaults.fixedThreshold,
        adaptiveBaseThreshold: defaults.adaptiveBaseThreshold,
        minAdaptiveThreshold: defaults.minAdaptiveThreshold,
        maxAdaptiveThreshold: defaults.maxAdaptiveThreshold,
        densityWeight: defaults.densityWeight,
        densityKNeighbors: defaults.densityKNeighbors,
        categoryWeights: { ...defaults.categoryWeights },
        updatedBy: null,
        createdAt: now,
        updatedAt: now,
      };
    }
    return settingsRecord;
  };

  const mockRepo: Partial<SemanticCacheRepository> = {
    getOrCreateSettings: jest.fn(async (defaults) => ensureSettings(defaults)),
    updateSettings: jest.fn(async (defaults, updater) => {
      const current = ensureSettings(defaults);
      const next = updater(current);
      settingsRecord = {
        ...current,
        ...next,
        updatedAt: new Date(),
      };
      return settingsRecord;
    }),
    createEntry: jest.fn(async (input) => {
      const now = new Date();
      const entry: SemanticCacheEntryRecord = {
        id: randomUUID(),
        query: input.query,
        response: input.response,
        embedding: input.embedding,
        category: input.category,
        model: input.model ?? null,
        hitCount: 0,
        lastHitAt: null,
        metadata: input.metadata ?? {},
        createdAt: now,
        updatedAt: now,
      };
      entries.set(entry.id, entry);
      sourcesByEntry.set(entry.id, input.sources);
      return { entry, sources: input.sources };
    }),
    findNearestNeighbors: jest.fn(async ({ embedding, category, limit }) => {
      return [...entries.values()]
        .filter((e) => e.category === category)
        .map((entry) => ({
          entry,
          similarity: cosineSim(embedding, entry.embedding),
          sources: sourcesByEntry.get(entry.id) ?? [],
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    }),
    recordHit: jest.fn(async (entryId) => {
      const entry = entries.get(entryId);
      if (entry) {
        entry.hitCount += 1;
        entry.lastHitAt = new Date();
      }
    }),
    invalidateByDocumentIds: jest.fn(async (docIds) => {
      const targetSet = new Set(docIds);
      let count = 0;
      for (const [entryId, sources] of sourcesByEntry.entries()) {
        if (sources.some((s) => targetSet.has(s.documentId))) {
          entries.delete(entryId);
          sourcesByEntry.delete(entryId);
          count += 1;
        }
      }
      return count;
    }),
    invalidateByCategory: jest.fn(async (category) => {
      let count = 0;
      for (const [entryId, entry] of entries.entries()) {
        if (entry.category === category) {
          entries.delete(entryId);
          sourcesByEntry.delete(entryId);
          count += 1;
        }
      }
      return count;
    }),
    clearAll: jest.fn(async () => {
      const count = entries.size;
      entries.clear();
      sourcesByEntry.clear();
      return count;
    }),
    getStats: jest.fn(async () => {
      const grouped = new Map<QueryCategory, { entryCount: number; totalHits: number }>();
      for (const entry of entries.values()) {
        const cat = entry.category as QueryCategory;
        const curr = grouped.get(cat) ?? { entryCount: 0, totalHits: 0 };
        curr.entryCount += 1;
        curr.totalHits += entry.hitCount;
        grouped.set(cat, curr);
      }
      return [...grouped.entries()].map(([category, stats]) => ({ category, ...stats }));
    }),
  };

  const service = new SemanticCacheService(
    mockRepo as SemanticCacheRepository,
    new ThresholdCalculatorService(),
  );

  return { service, mockRepo, entries };
}

describe('SemanticCacheService', () => {
  it('stores entries with deduplicated KB sources and increments hitCount on HIT', async () => {
    const { service, entries } = createServiceHarness();
    const docId = '11111111-1111-4111-8111-111111111111';
    const embedding = makeUnitVector(10);

    const stored = await service.store({
      query: '  How do I pay my bill?  ',
      response: 'You can pay in the SemCache app.',
      embedding,
      category: QueryCategory.BILLING,
      knowledgeSourceIds: [docId, docId],
      knowledgeSources: [{ documentId: docId, documentTitle: 'Billing Guide' }],
    });

    expect(stored.query).toBe('How do I pay my bill?');
    expect(stored.knowledgeSourceIds).toEqual([docId]);
    expect(stored.knowledgeSources).toHaveLength(1);

    const lookup = await service.lookup({
      query: 'How do I pay my bill?',
      embedding,
      category: QueryCategory.BILLING,
    });
    expect(lookup.status).toBe(CacheHitStatus.HIT);
    expect(lookup.cachedResponse).toBe('You can pay in the SemCache app.');
    expect(entries.get(stored.id)?.hitCount).toBe(1);
  });

  it('supports switching persisted modes and per-request mode overrides', async () => {
    const { service } = createServiceHarness();
    const embedding = makeUnitVector(20);
    await service.store({
      query: 'Roaming rates in EU',
      response: 'EU roaming is included.',
      embedding,
      category: QueryCategory.PRODUCT_INQUIRY,
    });

    await service.updateSettings({ mode: CacheMode.DISABLED }, 'admin-1');
    const bypassed = await service.lookup({
      query: 'Roaming rates in EU',
      embedding,
      category: QueryCategory.PRODUCT_INQUIRY,
    });
    expect(bypassed.status).toBe(CacheHitStatus.BYPASS);

    const fixedOverrideHit = await service.lookup({
      query: 'Roaming rates in EU',
      embedding,
      category: QueryCategory.PRODUCT_INQUIRY,
      mode: CacheMode.FIXED,
    });
    expect(fixedOverrideHit.status).toBe(CacheHitStatus.HIT);
    expect(fixedOverrideHit.mode).toBe(CacheMode.FIXED);
  });

  it('merges partial categoryWeights and validates minAdaptiveThreshold <= maxAdaptiveThreshold', async () => {
    const { service } = createServiceHarness();

    const updated = await service.updateSettings(
      {
        fixedThreshold: 0.92,
        categoryWeights: { [QueryCategory.BILLING]: 0.09 },
      },
      'admin-1',
    );
    expect(updated.fixedThreshold).toBe(0.92);
    expect(updated.categoryWeights[QueryCategory.BILLING]).toBe(0.09);
    expect(updated.categoryWeights[QueryCategory.GENERAL]).toBe(
      DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS[QueryCategory.GENERAL],
    );

    await expect(
      service.updateSettings({ minAdaptiveThreshold: 0.95, maxAdaptiveThreshold: 0.8 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('invalidates by KB sources, by category, clears all, and reports stats', async () => {
    const { service } = createServiceHarness();
    const docA = '11111111-1111-4111-8111-111111111111';
    const docB = '22222222-2222-4222-8222-222222222222';

    await service.store({
      query: 'Q1',
      response: 'A1',
      embedding: makeUnitVector(1),
      category: QueryCategory.BILLING,
      knowledgeSourceIds: [docA],
    });
    await service.store({
      query: 'Q2',
      response: 'A2',
      embedding: makeUnitVector(2),
      category: QueryCategory.TECHNICAL_SUPPORT,
      knowledgeSourceIds: [docB],
    });
    await service.store({
      query: 'Q3',
      response: 'A3',
      embedding: makeUnitVector(3),
      category: QueryCategory.GENERAL,
    });

    const statsBefore = await service.getStats();
    expect(statsBefore.totalEntries).toBe(3);
    expect(statsBefore.byCategory).toHaveLength(Object.values(QueryCategory).length);

    const bySource = await service.invalidateBySources([docA]);
    expect(bySource).toEqual({
      invalidatedCount: 1,
      scope: 'sources',
      documentIds: [docA],
    });

    const byCategory = await service.invalidateByCategory(QueryCategory.TECHNICAL_SUPPORT);
    expect(byCategory).toEqual({
      invalidatedCount: 1,
      scope: 'category',
      category: QueryCategory.TECHNICAL_SUPPORT,
    });

    const cleared = await service.clearAll();
    expect(cleared).toEqual({
      invalidatedCount: 1,
      scope: 'all',
    });
  });
});
