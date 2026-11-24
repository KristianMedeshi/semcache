import { BadRequestException, Injectable } from '@nestjs/common';
import {
  type CacheKnowledgeSourceReferenceDto,
  DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS,
  SEMANTIC_CACHE_VALIDATION_LIMITS,
  type SemanticCacheLookupResponseDto,
  type SemanticCacheSettingsResponseDto,
} from '@semcache/shared-dtos';
import { CacheHitStatus, CacheMode, QueryCategory } from '@semcache/shared-types';
import type { SemanticCacheEntryRecord } from '../db/schema';

export interface NearestCacheCandidate {
  entry: SemanticCacheEntryRecord;
  similarity: number;
  sources: CacheKnowledgeSourceReferenceDto[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

@Injectable()
export class ThresholdCalculatorService {
  validateEmbeddingVector(embedding: number[]): void {
    if (embedding.length !== SEMANTIC_CACHE_VALIDATION_LIMITS.EMBEDDING_DIMENSIONS) {
      throw new BadRequestException(
        `Embedding vector must have exactly ${SEMANTIC_CACHE_VALIDATION_LIMITS.EMBEDDING_DIMENSIONS} dimensions`,
      );
    }

    let sumOfSquares = 0;
    for (const component of embedding) {
      if (!Number.isFinite(component)) {
        throw new BadRequestException('Embedding vector must contain only finite numbers');
      }
      sumOfSquares += component * component;
    }

    if (sumOfSquares <= 0) {
      throw new BadRequestException('Embedding vector must have non-zero norm');
    }
  }

  computeLocalClusterDensity(neighborSimilarities: number[], kNeighbors: number): number {
    if (neighborSimilarities.length === 0) {
      return 0;
    }

    const denominator = Math.max(1, kNeighbors);
    const positiveSum = neighborSimilarities
      .slice(0, denominator)
      .reduce((sum, similarity) => sum + Math.max(0, clamp(similarity, -1, 1)), 0);

    return clamp(positiveSum / denominator, 0, 1);
  }

  computeAdaptiveThreshold(
    category: QueryCategory,
    localClusterDensity: number,
    settings: SemanticCacheSettingsResponseDto,
  ): number {
    const categoryWeight =
      settings.categoryWeights[category] ?? DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS[category] ?? 0;

    const rawThreshold =
      settings.adaptiveBaseThreshold +
      categoryWeight +
      settings.densityWeight * localClusterDensity;

    return clamp(rawThreshold, settings.minAdaptiveThreshold, settings.maxAdaptiveThreshold);
  }

  evaluateLookup(params: {
    mode: CacheMode;
    category: QueryCategory;
    settings: SemanticCacheSettingsResponseDto;
    candidates: NearestCacheCandidate[];
    fixedThresholdOverride?: number;
  }): SemanticCacheLookupResponseDto {
    const { mode, category, settings, candidates, fixedThresholdOverride } = params;

    if (mode === CacheMode.DISABLED) {
      return {
        status: CacheHitStatus.BYPASS,
        mode,
        evaluation: {
          category,
          cosineSimilarity: 0,
          adaptiveThreshold: 0,
          localClusterDensity: 0,
          cacheStatus: CacheHitStatus.BYPASS,
          mode,
          neighborCount: 0,
        },
      };
    }

    const topCandidate = candidates[0];
    const rawSimilarity = topCandidate ? clamp(topCandidate.similarity, -1, 1) : 0;

    let rawThreshold: number;
    let rawDensity = 0;

    if (mode === CacheMode.FIXED) {
      rawThreshold = fixedThresholdOverride ?? settings.fixedThreshold;
    } else {
      rawDensity = this.computeLocalClusterDensity(
        candidates.map((candidate) => candidate.similarity),
        settings.densityKNeighbors,
      );
      rawThreshold = this.computeAdaptiveThreshold(category, rawDensity, settings);
    }

    const isHit = Boolean(topCandidate && rawSimilarity >= rawThreshold);
    const status = isHit ? CacheHitStatus.HIT : CacheHitStatus.MISS;

    if (isHit && topCandidate) {
      const knowledgeSourceIds = [...new Set(topCandidate.sources.map((s) => s.documentId))];
      return {
        status,
        mode,
        entryId: topCandidate.entry.id,
        cachedResponse: topCandidate.entry.response,
        matchedQuery: topCandidate.entry.query,
        knowledgeSourceIds,
        knowledgeSources: topCandidate.sources,
        evaluation: {
          category,
          cosineSimilarity: roundMetric(rawSimilarity),
          adaptiveThreshold: roundMetric(rawThreshold),
          localClusterDensity: roundMetric(rawDensity),
          cacheStatus: status,
          mode,
          neighborCount: candidates.length,
        },
      };
    }

    return {
      status,
      mode,
      evaluation: {
        category,
        cosineSimilarity: roundMetric(rawSimilarity),
        adaptiveThreshold: roundMetric(rawThreshold),
        localClusterDensity: roundMetric(rawDensity),
        cacheStatus: status,
        mode,
        neighborCount: candidates.length,
      },
    };
  }
}
