import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@semcache/shared-config';
import {
  type CacheInvalidationResponseDto,
  type CacheKnowledgeSourceReferenceDto,
  DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS,
  SEMANTIC_CACHE_VALIDATION_LIMITS,
  type SemanticCacheCategoryStatsDto,
  type SemanticCacheCategoryWeightsDto,
  type SemanticCacheEntryResponseDto,
  type SemanticCacheLookupRequestDto,
  type SemanticCacheLookupResponseDto,
  type SemanticCacheSettingsResponseDto,
  type SemanticCacheStatsResponseDto,
  type SemanticCacheStoreRequestDto,
  type UpdateSemanticCacheSettingsRequestDto,
} from '@semcache/shared-dtos';
import { CacheHitStatus, CacheMode, QueryCategory } from '@semcache/shared-types';
import type { SemanticCacheEnv } from '../config/semantic-cache.env';
import {
  type DefaultSettingsSeed,
  SemanticCacheRepository,
  toSemanticCacheEntryResponseDto,
  toSemanticCacheSettingsResponseDto,
} from './semantic-cache.repository';
import { ThresholdCalculatorService } from './threshold-calculator.service';

@Injectable()
export class SemanticCacheService {
  constructor(
    private readonly repository: SemanticCacheRepository,
    private readonly thresholdCalculator: ThresholdCalculatorService,
    @Optional() private readonly config?: ConfigService<SemanticCacheEnv, true>,
  ) {}

  async lookup(dto: SemanticCacheLookupRequestDto): Promise<SemanticCacheLookupResponseDto> {
    const settingsRecord = await this.repository.getOrCreateSettings(this.getDefaultSettingsSeed());
    const settings = toSemanticCacheSettingsResponseDto(settingsRecord);
    const effectiveMode = dto.mode ?? settings.mode;
    const category = dto.category ?? QueryCategory.GENERAL;

    if (effectiveMode === CacheMode.DISABLED) {
      return this.thresholdCalculator.evaluateLookup({
        mode: effectiveMode,
        category,
        settings,
        candidates: [],
      });
    }

    if (!dto.embedding) {
      throw new BadRequestException('Embedding vector is required when cache is enabled');
    }
    this.thresholdCalculator.validateEmbeddingVector(dto.embedding);

    const limit = effectiveMode === CacheMode.ADAPTIVE ? settings.densityKNeighbors : 1;
    const candidates = await this.repository.findNearestNeighbors({
      embedding: dto.embedding,
      category,
      limit,
    });

    const result = this.thresholdCalculator.evaluateLookup({
      mode: effectiveMode,
      category,
      settings,
      candidates,
      fixedThresholdOverride: dto.fixedThresholdOverride,
    });

    if (result.status === CacheHitStatus.HIT && result.entryId) {
      await this.repository.recordHit(result.entryId);
    }

    return result;
  }

  async store(dto: SemanticCacheStoreRequestDto): Promise<SemanticCacheEntryResponseDto> {
    const trimmedQuery = dto.query.trim();
    if (trimmedQuery.length === 0) {
      throw new BadRequestException('Query must not be empty');
    }

    this.thresholdCalculator.validateEmbeddingVector(dto.embedding);
    const normalizedSources = this.normalizeSources(dto.knowledgeSourceIds, dto.knowledgeSources);

    const { entry, sources } = await this.repository.createEntry({
      query: trimmedQuery,
      response: dto.response,
      embedding: dto.embedding,
      category: dto.category ?? QueryCategory.GENERAL,
      model: dto.model?.trim() || undefined,
      metadata: dto.metadata ?? {},
      sources: normalizedSources,
    });

    return toSemanticCacheEntryResponseDto(entry, sources);
  }

  async invalidateBySources(documentIds: string[]): Promise<CacheInvalidationResponseDto> {
    const uniqueDocumentIds = [...new Set(documentIds)];
    const invalidatedCount = await this.repository.invalidateByDocumentIds(uniqueDocumentIds);

    return {
      invalidatedCount,
      scope: 'sources',
      documentIds: uniqueDocumentIds,
    };
  }

  async invalidateByCategory(category: QueryCategory): Promise<CacheInvalidationResponseDto> {
    const invalidatedCount = await this.repository.invalidateByCategory(category);

    return {
      invalidatedCount,
      scope: 'category',
      category,
    };
  }

  async invalidateUnlinked(): Promise<CacheInvalidationResponseDto> {
    const invalidatedCount = await this.repository.invalidateUnlinked();

    return {
      invalidatedCount,
      scope: 'unlinked',
    };
  }

  async clearAll(): Promise<CacheInvalidationResponseDto> {
    const invalidatedCount = await this.repository.clearAll();

    return {
      invalidatedCount,
      scope: 'all',
    };
  }

  async getSettings(): Promise<SemanticCacheSettingsResponseDto> {
    const record = await this.repository.getOrCreateSettings(this.getDefaultSettingsSeed());
    return toSemanticCacheSettingsResponseDto(record);
  }

  async updateSettings(
    dto: UpdateSemanticCacheSettingsRequestDto,
    updatedBy?: string,
  ): Promise<SemanticCacheSettingsResponseDto> {
    const updatedRecord = await this.repository.updateSettings(
      this.getDefaultSettingsSeed(),
      (current) => {
        const nextMin = dto.minAdaptiveThreshold ?? current.minAdaptiveThreshold;
        const nextMax = dto.maxAdaptiveThreshold ?? current.maxAdaptiveThreshold;
        if (nextMin > nextMax) {
          throw new BadRequestException(
            'minAdaptiveThreshold must be less than or equal to maxAdaptiveThreshold',
          );
        }

        const mergedCategoryWeights: SemanticCacheCategoryWeightsDto = {
          ...DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS,
          ...current.categoryWeights,
          ...(dto.categoryWeights ?? {}),
        };

        return {
          mode: (dto.mode ?? current.mode) as CacheMode,
          fixedThreshold: dto.fixedThreshold ?? current.fixedThreshold,
          adaptiveBaseThreshold: dto.adaptiveBaseThreshold ?? current.adaptiveBaseThreshold,
          minAdaptiveThreshold: nextMin,
          maxAdaptiveThreshold: nextMax,
          densityWeight: dto.densityWeight ?? current.densityWeight,
          densityKNeighbors: dto.densityKNeighbors ?? current.densityKNeighbors,
          categoryWeights: mergedCategoryWeights,
          updatedBy: updatedBy ?? current.updatedBy ?? null,
        };
      },
    );

    return toSemanticCacheSettingsResponseDto(updatedRecord);
  }

  async getStats(): Promise<SemanticCacheStatsResponseDto> {
    const [settings, groupedStats] = await Promise.all([
      this.getSettings(),
      this.repository.getStats(),
    ]);

    const byCategoryMap = new Map(groupedStats.map((item) => [item.category, item]));
    const byCategory: SemanticCacheCategoryStatsDto[] = Object.values(QueryCategory).map(
      (category) =>
        byCategoryMap.get(category) ?? {
          category,
          entryCount: 0,
          totalHits: 0,
        },
    );

    const totalEntries = byCategory.reduce((sum, item) => sum + item.entryCount, 0);
    const totalHits = byCategory.reduce((sum, item) => sum + item.totalHits, 0);

    return {
      mode: settings.mode,
      totalEntries,
      totalHits,
      byCategory,
    };
  }

  private getDefaultSettingsSeed(): DefaultSettingsSeed {
    return {
      mode: this.config?.get('SEMANTIC_CACHE_DEFAULT_MODE') ?? CacheMode.ADAPTIVE,
      fixedThreshold:
        this.config?.get('SEMANTIC_CACHE_FIXED_THRESHOLD') ??
        SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_FIXED_THRESHOLD,
      adaptiveBaseThreshold:
        this.config?.get('SEMANTIC_CACHE_ADAPTIVE_BASE_THRESHOLD') ??
        SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_BASE_THRESHOLD,
      minAdaptiveThreshold:
        this.config?.get('SEMANTIC_CACHE_MIN_ADAPTIVE_THRESHOLD') ??
        SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_MIN_ADAPTIVE_THRESHOLD,
      maxAdaptiveThreshold:
        this.config?.get('SEMANTIC_CACHE_MAX_ADAPTIVE_THRESHOLD') ??
        SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_MAX_ADAPTIVE_THRESHOLD,
      densityWeight:
        this.config?.get('SEMANTIC_CACHE_DENSITY_WEIGHT') ??
        SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_DENSITY_WEIGHT,
      densityKNeighbors:
        this.config?.get('SEMANTIC_CACHE_DENSITY_K_NEIGHBORS') ??
        SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_DENSITY_K_NEIGHBORS,
      categoryWeights: { ...DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS },
    };
  }

  private normalizeSources(
    sourceIds?: string[],
    sourceRefs?: CacheKnowledgeSourceReferenceDto[],
  ): CacheKnowledgeSourceReferenceDto[] {
    const byKey = new Map<string, CacheKnowledgeSourceReferenceDto>();

    for (const ref of sourceRefs ?? []) {
      const key = `${ref.documentId}:${ref.chunkId ?? ''}`;
      byKey.set(key, {
        documentId: ref.documentId,
        ...(ref.documentTitle !== undefined ? { documentTitle: ref.documentTitle } : {}),
        ...(ref.chunkId !== undefined ? { chunkId: ref.chunkId } : {}),
        ...(ref.chunkIndex !== undefined ? { chunkIndex: ref.chunkIndex } : {}),
      });
    }

    const representedDocIds = new Set([...byKey.values()].map((ref) => ref.documentId));
    for (const documentId of sourceIds ?? []) {
      if (!representedDocIds.has(documentId)) {
        representedDocIds.add(documentId);
        byKey.set(`${documentId}:`, { documentId });
      }
    }

    return [...byKey.values()];
  }
}
