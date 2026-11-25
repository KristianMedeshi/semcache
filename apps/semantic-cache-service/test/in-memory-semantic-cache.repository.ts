import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  CacheKnowledgeSourceReferenceDto,
  SemanticCacheCategoryStatsDto,
} from '@semcache/shared-dtos';
import { QueryCategory } from '@semcache/shared-types';
import type { SemanticCacheEntryRecord, SemanticCacheSettingsRecord } from '../src/db/schema';
import type { DefaultSettingsSeed } from '../src/semantic-cache/semantic-cache.repository';

export function makeUnitVector(seed: number, floor = 0.01): number[] {
  const vec = Array.from({ length: 384 }, (_, idx) => (idx === seed % 384 ? 1 : floor));
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map((v) => v / norm);
}

export function cosineSim(a: number[], b: number[]): number {
  return a.reduce((sum, v, idx) => sum + v * (b[idx] ?? 0), 0);
}

@Injectable()
export class InMemorySemanticCacheRepository {
  readonly entries = new Map<string, SemanticCacheEntryRecord>();
  readonly sourcesByEntry = new Map<string, CacheKnowledgeSourceReferenceDto[]>();
  private settings: SemanticCacheSettingsRecord | null = null;

  private ensureSettings(defaults: DefaultSettingsSeed): SemanticCacheSettingsRecord {
    if (!this.settings) {
      const now = new Date();
      this.settings = {
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
    return this.settings;
  }

  async getOrCreateSettings(defaults: DefaultSettingsSeed): Promise<SemanticCacheSettingsRecord> {
    return this.ensureSettings(defaults);
  }

  async updateSettings(
    defaults: DefaultSettingsSeed,
    updater: (current: SemanticCacheSettingsRecord) => Record<string, unknown>,
  ): Promise<SemanticCacheSettingsRecord> {
    const current = this.ensureSettings(defaults);
    this.settings = {
      ...current,
      ...(updater(current) as Partial<SemanticCacheSettingsRecord>),
      updatedAt: new Date(),
    };
    return this.settings;
  }

  async findNearestNeighbors(params: {
    embedding: number[];
    category: QueryCategory;
    limit: number;
  }) {
    return [...this.entries.values()]
      .filter((entry) => entry.category === params.category)
      .map((entry) => ({
        entry,
        similarity: cosineSim(params.embedding, entry.embedding),
        sources: this.sourcesByEntry.get(entry.id) ?? [],
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, params.limit);
  }

  async createEntry(input: {
    query: string;
    response: string;
    embedding: number[];
    category: QueryCategory;
    model?: string;
    metadata?: Record<string, string | number | boolean>;
    sources: CacheKnowledgeSourceReferenceDto[];
  }): Promise<{ entry: SemanticCacheEntryRecord; sources: CacheKnowledgeSourceReferenceDto[] }> {
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
    this.entries.set(entry.id, entry);
    this.sourcesByEntry.set(entry.id, input.sources);
    return { entry, sources: input.sources };
  }

  async recordHit(entryId: string): Promise<void> {
    const entry = this.entries.get(entryId);
    if (entry) {
      entry.hitCount += 1;
      entry.lastHitAt = new Date();
    }
  }

  async invalidateByDocumentIds(documentIds: string[]): Promise<number> {
    const targetSet = new Set(documentIds);
    let count = 0;
    for (const [entryId, sources] of this.sourcesByEntry.entries()) {
      if (sources.some((s) => targetSet.has(s.documentId))) {
        this.entries.delete(entryId);
        this.sourcesByEntry.delete(entryId);
        count += 1;
      }
    }
    return count;
  }

  async invalidateByCategory(category: QueryCategory): Promise<number> {
    let count = 0;
    for (const [entryId, entry] of this.entries.entries()) {
      if (entry.category === category) {
        this.entries.delete(entryId);
        this.sourcesByEntry.delete(entryId);
        count += 1;
      }
    }
    return count;
  }

  async invalidateUnlinked(): Promise<number> {
    let count = 0;
    for (const entryId of [...this.entries.keys()]) {
      const sources = this.sourcesByEntry.get(entryId) ?? [];
      if (sources.length === 0) {
        this.entries.delete(entryId);
        this.sourcesByEntry.delete(entryId);
        count += 1;
      }
    }
    return count;
  }

  async clearAll(): Promise<number> {
    const count = this.entries.size;
    this.entries.clear();
    this.sourcesByEntry.clear();
    return count;
  }

  async getStats(): Promise<SemanticCacheCategoryStatsDto[]> {
    const grouped = new Map<QueryCategory, { entryCount: number; totalHits: number }>();
    for (const entry of this.entries.values()) {
      const cat = entry.category as QueryCategory;
      const curr = grouped.get(cat) ?? { entryCount: 0, totalHits: 0 };
      curr.entryCount += 1;
      curr.totalHits += entry.hitCount;
      grouped.set(cat, curr);
    }
    return [...grouped.entries()].map(([category, stats]) => ({ category, ...stats }));
  }
}
