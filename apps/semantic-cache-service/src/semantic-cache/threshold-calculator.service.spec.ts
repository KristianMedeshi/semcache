import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS,
  type SemanticCacheSettingsResponseDto,
} from '@semcache/shared-dtos';
import { CacheHitStatus, CacheMode, QueryCategory } from '@semcache/shared-types';
import type { SemanticCacheEntryRecord } from '../db/schema';
import {
  type NearestCacheCandidate,
  ThresholdCalculatorService,
} from './threshold-calculator.service';

function makeSettings(
  overrides: Partial<SemanticCacheSettingsResponseDto> = {},
): SemanticCacheSettingsResponseDto {
  return {
    id: 'default',
    mode: CacheMode.ADAPTIVE,
    fixedThreshold: 0.9,
    adaptiveBaseThreshold: 0.85,
    minAdaptiveThreshold: 0.72,
    maxAdaptiveThreshold: 0.97,
    densityWeight: 0.08,
    densityKNeighbors: 5,
    categoryWeights: { ...DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS },
    updatedBy: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeCandidate(similarity: number, id = 'entry-1'): NearestCacheCandidate {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const entry: SemanticCacheEntryRecord = {
    id,
    query: 'How do I activate my eSIM?',
    response: 'Scan the QR code in Settings.',
    category: QueryCategory.TECHNICAL_SUPPORT,
    embedding: Array.from({ length: 384 }, () => 0.05),
    model: 'openrouter/free',
    hitCount: 0,
    lastHitAt: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
  return {
    entry,
    similarity,
    sources: [{ documentId: '11111111-1111-4111-8111-111111111111', documentTitle: 'eSIM Guide' }],
  };
}

describe('ThresholdCalculatorService', () => {
  let calculator: ThresholdCalculatorService;

  beforeEach(() => {
    calculator = new ThresholdCalculatorService();
  });

  it('rejects invalid dimensions, non-finite values, and zero-norm embeddings', () => {
    expect(() => calculator.validateEmbeddingVector([1, 2, 3])).toThrow(BadRequestException);
    expect(() =>
      calculator.validateEmbeddingVector([Number.NaN, ...Array.from({ length: 383 }, () => 0.1)]),
    ).toThrow(BadRequestException);
    expect(() => calculator.validateEmbeddingVector(Array.from({ length: 384 }, () => 0))).toThrow(
      BadRequestException,
    );
    expect(() =>
      calculator.validateEmbeddingVector(Array.from({ length: 384 }, () => 0.05)),
    ).not.toThrow();
  });

  it('bypasses lookup when mode is DISABLED', () => {
    const result = calculator.evaluateLookup({
      mode: CacheMode.DISABLED,
      category: QueryCategory.BILLING,
      settings: makeSettings(),
      candidates: [makeCandidate(0.99)],
    });

    expect(result.status).toBe(CacheHitStatus.BYPASS);
    expect(result.mode).toBe(CacheMode.DISABLED);
    expect(result.cachedResponse).toBeUndefined();
    expect(result.evaluation.cacheStatus).toBe(CacheHitStatus.BYPASS);
  });

  it('evaluates FIXED mode with persisted threshold and per-request fixedThresholdOverride', () => {
    const settings = makeSettings({ fixedThreshold: 0.9 });

    const miss = calculator.evaluateLookup({
      mode: CacheMode.FIXED,
      category: QueryCategory.GENERAL,
      settings,
      candidates: [makeCandidate(0.8999)],
    });
    expect(miss.status).toBe(CacheHitStatus.MISS);
    expect(miss.evaluation.adaptiveThreshold).toBe(0.9);

    const exactHit = calculator.evaluateLookup({
      mode: CacheMode.FIXED,
      category: QueryCategory.GENERAL,
      settings,
      candidates: [makeCandidate(0.9)],
    });
    expect(exactHit.status).toBe(CacheHitStatus.HIT);
    expect(exactHit.cachedResponse).toBe('Scan the QR code in Settings.');
    expect(exactHit.knowledgeSourceIds).toEqual(['11111111-1111-4111-8111-111111111111']);

    const overrideHit = calculator.evaluateLookup({
      mode: CacheMode.FIXED,
      category: QueryCategory.GENERAL,
      settings,
      candidates: [makeCandidate(0.86)],
      fixedThresholdOverride: 0.85,
    });
    expect(overrideHit.status).toBe(CacheHitStatus.HIT);
    expect(overrideHit.evaluation.adaptiveThreshold).toBe(0.85);
  });

  it('computes higher adaptive threshold in dense clusters and stricter categories, respecting min/max bounds', () => {
    const settings = makeSettings();

    const sparseDensity = calculator.computeLocalClusterDensity([0.5], 5);
    const denseDensity = calculator.computeLocalClusterDensity([0.96, 0.95, 0.94, 0.93, 0.92], 5);
    expect(denseDensity).toBeGreaterThan(sparseDensity);

    const billingThreshold = calculator.computeAdaptiveThreshold(
      QueryCategory.BILLING,
      denseDensity,
      settings,
    );
    const generalThreshold = calculator.computeAdaptiveThreshold(
      QueryCategory.GENERAL,
      denseDensity,
      settings,
    );
    expect(billingThreshold).toBeGreaterThan(generalThreshold);

    const clampedHigh = calculator.computeAdaptiveThreshold(
      QueryCategory.BILLING,
      1,
      makeSettings({ adaptiveBaseThreshold: 0.99, maxAdaptiveThreshold: 0.95 }),
    );
    expect(clampedHigh).toBe(0.95);

    const clampedLow = calculator.computeAdaptiveThreshold(
      QueryCategory.GENERAL,
      1,
      makeSettings({
        adaptiveBaseThreshold: 0.7,
        densityWeight: -0.2,
        minAdaptiveThreshold: 0.75,
      }),
    );
    expect(clampedLow).toBe(0.75);
  });

  it('evaluates ADAPTIVE mode using local cluster density and category weight', () => {
    const settings = makeSettings();
    const hitResult = calculator.evaluateLookup({
      mode: CacheMode.ADAPTIVE,
      category: QueryCategory.BILLING,
      settings,
      candidates: [
        makeCandidate(0.95, 'e-1'),
        makeCandidate(0.91, 'e-2'),
        makeCandidate(0.9, 'e-3'),
      ],
    });

    expect(hitResult.status).toBe(CacheHitStatus.HIT);
    expect(hitResult.evaluation.neighborCount).toBe(3);
    expect(hitResult.evaluation.localClusterDensity).toBeGreaterThan(0);
    expect(hitResult.evaluation.adaptiveThreshold).toBeGreaterThan(0.9);
    expect(hitResult.evaluation.adaptiveThreshold).toBeLessThanOrEqual(0.95);

    const missResult = calculator.evaluateLookup({
      mode: CacheMode.ADAPTIVE,
      category: QueryCategory.BILLING,
      settings,
      candidates: [
        makeCandidate(0.94, 'e-1'),
        makeCandidate(0.91, 'e-2'),
        makeCandidate(0.9, 'e-3'),
      ],
    });
    expect(missResult.status).toBe(CacheHitStatus.MISS);
  });
});
