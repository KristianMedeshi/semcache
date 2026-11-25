import { Inject, Injectable } from '@nestjs/common';
import type {
  CacheKnowledgeSourceReferenceDto,
  SemanticCacheCategoryStatsDto,
  SemanticCacheCategoryWeightsDto,
  SemanticCacheEntryResponseDto,
  SemanticCacheSettingsResponseDto,
} from '@semcache/shared-dtos';
import { CacheMode, QueryCategory } from '@semcache/shared-types';
import { asc, cosineDistance, eq, inArray, notExists, sql } from 'drizzle-orm';
import { SEMANTIC_CACHE_DRIZZLE, type SemanticCacheDatabase } from '../db/database.module';
import {
  type SemanticCacheEntryRecord,
  type SemanticCacheEntrySourceRecord,
  type SemanticCacheSettingsRecord,
  semanticCacheEntries,
  semanticCacheEntrySources,
  semanticCacheSettings,
} from '../db/schema';
import type { NearestCacheCandidate } from './threshold-calculator.service';

export const DEFAULT_SETTINGS_ID = 'default';

export interface CreateCacheEntryInput {
  query: string;
  response: string;
  embedding: number[];
  category: QueryCategory;
  model?: string;
  metadata?: Record<string, string | number | boolean>;
  sources: CacheKnowledgeSourceReferenceDto[];
}

export interface DefaultSettingsSeed {
  mode: CacheMode;
  fixedThreshold: number;
  adaptiveBaseThreshold: number;
  minAdaptiveThreshold: number;
  maxAdaptiveThreshold: number;
  densityWeight: number;
  densityKNeighbors: number;
  categoryWeights: SemanticCacheCategoryWeightsDto;
}

export function toCacheSourceDto(
  record: SemanticCacheEntrySourceRecord,
): CacheKnowledgeSourceReferenceDto {
  return {
    documentId: record.documentId,
    ...(record.documentTitle !== null ? { documentTitle: record.documentTitle } : {}),
    ...(record.chunkId !== null ? { chunkId: record.chunkId } : {}),
    ...(record.chunkIndex !== null ? { chunkIndex: record.chunkIndex } : {}),
  };
}

export function toSemanticCacheEntryResponseDto(
  entry: SemanticCacheEntryRecord,
  sources: CacheKnowledgeSourceReferenceDto[],
): SemanticCacheEntryResponseDto {
  return {
    id: entry.id,
    query: entry.query,
    response: entry.response,
    category: entry.category as QueryCategory,
    model: entry.model ?? null,
    hitCount: entry.hitCount,
    lastHitAt: entry.lastHitAt ? entry.lastHitAt.toISOString() : null,
    knowledgeSourceIds: [...new Set(sources.map((s) => s.documentId))],
    knowledgeSources: sources,
    metadata: entry.metadata ?? {},
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export function toSemanticCacheSettingsResponseDto(
  record: SemanticCacheSettingsRecord,
): SemanticCacheSettingsResponseDto {
  return {
    id: record.id,
    mode: record.mode as CacheMode,
    fixedThreshold: record.fixedThreshold,
    adaptiveBaseThreshold: record.adaptiveBaseThreshold,
    minAdaptiveThreshold: record.minAdaptiveThreshold,
    maxAdaptiveThreshold: record.maxAdaptiveThreshold,
    densityWeight: record.densityWeight,
    densityKNeighbors: record.densityKNeighbors,
    categoryWeights: record.categoryWeights,
    updatedBy: record.updatedBy ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

@Injectable()
export class SemanticCacheRepository {
  constructor(@Inject(SEMANTIC_CACHE_DRIZZLE) private readonly db: SemanticCacheDatabase) {}

  private async ensureSettingsRow(
    executor: Pick<SemanticCacheDatabase, 'insert' | 'select'>,
    defaults: DefaultSettingsSeed,
  ): Promise<SemanticCacheSettingsRecord> {
    await executor
      .insert(semanticCacheSettings)
      .values({
        id: DEFAULT_SETTINGS_ID,
        mode: defaults.mode,
        fixedThreshold: defaults.fixedThreshold,
        adaptiveBaseThreshold: defaults.adaptiveBaseThreshold,
        minAdaptiveThreshold: defaults.minAdaptiveThreshold,
        maxAdaptiveThreshold: defaults.maxAdaptiveThreshold,
        densityWeight: defaults.densityWeight,
        densityKNeighbors: defaults.densityKNeighbors,
        categoryWeights: defaults.categoryWeights,
      })
      .onConflictDoNothing();

    const rows = await executor
      .select()
      .from(semanticCacheSettings)
      .where(eq(semanticCacheSettings.id, DEFAULT_SETTINGS_ID))
      .limit(1);

    const record = rows[0];
    if (!record) {
      throw new Error('Failed to load semantic cache settings record');
    }
    return record;
  }

  async getOrCreateSettings(defaults: DefaultSettingsSeed): Promise<SemanticCacheSettingsRecord> {
    return this.ensureSettingsRow(this.db, defaults);
  }

  async updateSettings(
    defaults: DefaultSettingsSeed,
    updater: (current: SemanticCacheSettingsRecord) => {
      mode: CacheMode;
      fixedThreshold: number;
      adaptiveBaseThreshold: number;
      minAdaptiveThreshold: number;
      maxAdaptiveThreshold: number;
      densityWeight: number;
      densityKNeighbors: number;
      categoryWeights: SemanticCacheCategoryWeightsDto;
      updatedBy: string | null;
    },
  ): Promise<SemanticCacheSettingsRecord> {
    return this.db.transaction(async (tx) => {
      const current = await this.ensureSettingsRow(tx, defaults);
      const nextValues = updater(current);
      const updatedRows = await tx
        .update(semanticCacheSettings)
        .set({
          ...nextValues,
          updatedAt: new Date(),
        })
        .where(eq(semanticCacheSettings.id, DEFAULT_SETTINGS_ID))
        .returning();

      const updated = updatedRows[0];
      if (!updated) {
        throw new Error('Failed to update semantic cache settings record');
      }
      return updated;
    });
  }

  async findNearestNeighbors(params: {
    embedding: number[];
    category: QueryCategory;
    limit: number;
  }): Promise<NearestCacheCandidate[]> {
    const distanceExpr = cosineDistance(semanticCacheEntries.embedding, params.embedding);
    const similarityExpr = sql<number>`1 - (${distanceExpr})`;

    const rows = await this.db
      .select({
        entry: semanticCacheEntries,
        similarity: similarityExpr,
      })
      .from(semanticCacheEntries)
      .where(eq(semanticCacheEntries.category, params.category))
      .orderBy(asc(distanceExpr))
      .limit(params.limit);

    if (rows.length === 0) {
      return [];
    }

    const topEntry = rows[0]?.entry;
    let topSources: CacheKnowledgeSourceReferenceDto[] = [];
    if (topEntry) {
      const sourceRows = await this.db
        .select()
        .from(semanticCacheEntrySources)
        .where(eq(semanticCacheEntrySources.entryId, topEntry.id));
      topSources = sourceRows.map(toCacheSourceDto);
    }

    return rows.map((row, index) => ({
      entry: row.entry,
      similarity: Number(row.similarity),
      sources: index === 0 ? topSources : [],
    }));
  }

  async createEntry(
    input: CreateCacheEntryInput,
  ): Promise<{ entry: SemanticCacheEntryRecord; sources: CacheKnowledgeSourceReferenceDto[] }> {
    return this.db.transaction(async (tx) => {
      const insertedRows = await tx
        .insert(semanticCacheEntries)
        .values({
          query: input.query,
          response: input.response,
          embedding: input.embedding,
          category: input.category,
          model: input.model ?? null,
          metadata: input.metadata ?? {},
        })
        .returning();

      const entry = insertedRows[0];
      if (!entry) {
        throw new Error('Failed to insert semantic cache entry');
      }

      let storedSources: CacheKnowledgeSourceReferenceDto[] = [];
      if (input.sources.length > 0) {
        const sourceRows = await tx
          .insert(semanticCacheEntrySources)
          .values(
            input.sources.map((source) => ({
              entryId: entry.id,
              documentId: source.documentId,
              documentTitle: source.documentTitle ?? null,
              chunkId: source.chunkId ?? null,
              chunkIndex: source.chunkIndex ?? null,
            })),
          )
          .returning();
        storedSources = sourceRows.map(toCacheSourceDto);
      }

      return { entry, sources: storedSources };
    });
  }

  async recordHit(entryId: string): Promise<void> {
    const now = new Date();
    await this.db
      .update(semanticCacheEntries)
      .set({
        hitCount: sql`${semanticCacheEntries.hitCount} + 1`,
        lastHitAt: now,
        updatedAt: now,
      })
      .where(eq(semanticCacheEntries.id, entryId));
  }

  async invalidateByDocumentIds(documentIds: string[]): Promise<number> {
    if (documentIds.length === 0) {
      return 0;
    }

    const matchingEntryIds = this.db
      .select({ entryId: semanticCacheEntrySources.entryId })
      .from(semanticCacheEntrySources)
      .where(inArray(semanticCacheEntrySources.documentId, documentIds));

    const deleted = await this.db
      .delete(semanticCacheEntries)
      .where(inArray(semanticCacheEntries.id, matchingEntryIds))
      .returning({ id: semanticCacheEntries.id });

    return deleted.length;
  }

  async invalidateByCategory(category: QueryCategory): Promise<number> {
    const deleted = await this.db
      .delete(semanticCacheEntries)
      .where(eq(semanticCacheEntries.category, category))
      .returning({ id: semanticCacheEntries.id });

    return deleted.length;
  }

  async invalidateUnlinked(): Promise<number> {
    const deleted = await this.db
      .delete(semanticCacheEntries)
      .where(
        notExists(
          this.db
            .select({ one: sql`1` })
            .from(semanticCacheEntrySources)
            .where(eq(semanticCacheEntrySources.entryId, semanticCacheEntries.id)),
        ),
      )
      .returning({ id: semanticCacheEntries.id });

    return deleted.length;
  }

  async clearAll(): Promise<number> {
    const deleted = await this.db
      .delete(semanticCacheEntries)
      .returning({ id: semanticCacheEntries.id });

    return deleted.length;
  }

  async getStats(): Promise<SemanticCacheCategoryStatsDto[]> {
    const rows = await this.db
      .select({
        category: semanticCacheEntries.category,
        entryCount: sql<number>`count(*)::int`,
        totalHits: sql<number>`coalesce(sum(${semanticCacheEntries.hitCount}), 0)::int`,
      })
      .from(semanticCacheEntries)
      .groupBy(semanticCacheEntries.category);

    return rows.map((row) => ({
      category: row.category as QueryCategory,
      entryCount: Number(row.entryCount),
      totalHits: Number(row.totalHits),
    }));
  }
}
