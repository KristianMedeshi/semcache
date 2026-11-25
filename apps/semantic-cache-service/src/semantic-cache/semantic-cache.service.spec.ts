import { BadRequestException } from '@nestjs/common';
import { DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS } from '@semcache/shared-dtos';
import { CacheHitStatus, CacheMode, QueryCategory } from '@semcache/shared-types';
import type { SemanticCacheRepository } from './semantic-cache.repository';
import { SemanticCacheService } from './semantic-cache.service';
import {
  InMemorySemanticCacheRepository,
  makeUnitVector,
} from '../../test/in-memory-semantic-cache.repository';
import { ThresholdCalculatorService } from './threshold-calculator.service';

function createServiceHarness() {
  const mockRepo = new InMemorySemanticCacheRepository();
  const service = new SemanticCacheService(
    mockRepo as unknown as SemanticCacheRepository,
    new ThresholdCalculatorService(),
  );

  return { service, mockRepo, entries: mockRepo.entries };
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

  it('invalidates only unlinked cache entries while preserving KB-linked entries', async () => {
    const { service, entries } = createServiceHarness();
    const docId = '11111111-1111-4111-8111-111111111111';

    const linked = await service.store({
      query: 'Linked billing question',
      response: 'Linked billing answer',
      embedding: makeUnitVector(1),
      category: QueryCategory.BILLING,
      knowledgeSourceIds: [docId],
    });
    await service.store({
      query: 'Unlinked general question',
      response: 'Unlinked general answer',
      embedding: makeUnitVector(2),
      category: QueryCategory.GENERAL,
    });
    await service.store({
      query: 'Unlinked tech question',
      response: 'Unlinked tech answer',
      embedding: makeUnitVector(3),
      category: QueryCategory.TECHNICAL_SUPPORT,
    });

    const result = await service.invalidateUnlinked();
    expect(result).toEqual({
      invalidatedCount: 2,
      scope: 'unlinked',
    });
    expect(entries.size).toBe(1);
    expect(entries.has(linked.id)).toBe(true);
  });
});
