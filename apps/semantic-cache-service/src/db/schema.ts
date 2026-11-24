import type { QueryCategory } from '@semcache/shared-types';
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  vector,
} from 'drizzle-orm/pg-core';

export const semanticCacheModeEnum = pgEnum('semantic_cache_mode', [
  'disabled',
  'fixed',
  'adaptive',
]);

export const semanticCacheCategoryEnum = pgEnum('semantic_cache_category', [
  'billing',
  'technical_support',
  'account_management',
  'product_inquiry',
  'general',
]);

export const semanticCacheEntries = pgTable(
  'semantic_cache_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    query: text('query').notNull(),
    response: text('response').notNull(),
    category: semanticCacheCategoryEnum('category').notNull().default('general'),
    embedding: vector('embedding', { dimensions: 384 }).notNull(),
    model: varchar('model', { length: 120 }),
    hitCount: integer('hit_count').notNull().default(0),
    lastHitAt: timestamp('last_hit_at', { withTimezone: true, mode: 'date' }),
    metadata: jsonb('metadata')
      .$type<Record<string, string | number | boolean>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('semantic_cache_entries_category_idx').on(table.category),
    index('semantic_cache_entries_created_at_idx').on(table.createdAt),
    index('semantic_cache_entries_embedding_hnsw_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  ],
);

export const semanticCacheEntrySources = pgTable(
  'semantic_cache_entry_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => semanticCacheEntries.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id').notNull(),
    documentTitle: varchar('document_title', { length: 200 }),
    chunkId: uuid('chunk_id'),
    chunkIndex: integer('chunk_index'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('semantic_cache_entry_sources_entry_id_idx').on(table.entryId),
    index('semantic_cache_entry_sources_document_id_idx').on(table.documentId),
  ],
);

export const semanticCacheSettings = pgTable('semantic_cache_settings', {
  id: varchar('id', { length: 32 }).primaryKey(),
  mode: semanticCacheModeEnum('mode').notNull().default('adaptive'),
  fixedThreshold: doublePrecision('fixed_threshold').notNull().default(0.9),
  adaptiveBaseThreshold: doublePrecision('adaptive_base_threshold').notNull().default(0.85),
  minAdaptiveThreshold: doublePrecision('min_adaptive_threshold').notNull().default(0.72),
  maxAdaptiveThreshold: doublePrecision('max_adaptive_threshold').notNull().default(0.97),
  densityWeight: doublePrecision('density_weight').notNull().default(0.08),
  densityKNeighbors: integer('density_k_neighbors').notNull().default(5),
  categoryWeights: jsonb('category_weights').$type<Record<QueryCategory, number>>().notNull(),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export type SemanticCacheEntryRecord = typeof semanticCacheEntries.$inferSelect;
export type NewSemanticCacheEntryRecord = typeof semanticCacheEntries.$inferInsert;
export type SemanticCacheEntrySourceRecord = typeof semanticCacheEntrySources.$inferSelect;
export type NewSemanticCacheEntrySourceRecord = typeof semanticCacheEntrySources.$inferInsert;
export type SemanticCacheSettingsRecord = typeof semanticCacheSettings.$inferSelect;
export type NewSemanticCacheSettingsRecord = typeof semanticCacheSettings.$inferInsert;
