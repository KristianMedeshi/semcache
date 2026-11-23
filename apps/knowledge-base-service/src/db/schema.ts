import {
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

export const knowledgeDocumentStatusEnum = pgEnum('kb_document_status', [
  'pending',
  'processing',
  'ready',
  'failed',
]);

export const knowledgeDocumentFormatEnum = pgEnum('kb_document_format', [
  'text',
  'markdown',
  'html',
  'json',
]);

export const knowledgeDocumentCategoryEnum = pgEnum('kb_document_category', [
  'billing',
  'technical_support',
  'account_management',
  'product_inquiry',
  'general',
]);

export const knowledgeDocuments = pgTable(
  'kb_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 200 }).notNull(),
    fileName: varchar('file_name', { length: 255 }),
    format: knowledgeDocumentFormatEnum('format').notNull().default('text'),
    category: knowledgeDocumentCategoryEnum('category').notNull().default('general'),
    rawContent: text('raw_content').notNull(),
    extractedContent: text('extracted_content').notNull().default(''),
    status: knowledgeDocumentStatusEnum('status').notNull().default('pending'),
    chunkCount: integer('chunk_count').notNull().default(0),
    characterCount: integer('character_count').notNull().default(0),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata')
      .$type<Record<string, string | number | boolean>>()
      .notNull()
      .default({}),
    uploadedBy: uuid('uploaded_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('kb_documents_status_idx').on(table.status),
    index('kb_documents_category_idx').on(table.category),
    index('kb_documents_created_at_idx').on(table.createdAt),
  ],
);

export const knowledgeChunks = pgTable(
  'kb_document_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    tokenCount: integer('token_count').notNull().default(0),
    characterCount: integer('character_count').notNull().default(0),
    embedding: vector('embedding', { dimensions: 384 }).notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, string | number | boolean>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('kb_chunks_document_id_idx').on(table.documentId),
    index('kb_chunks_embedding_hnsw_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ],
);

export type KnowledgeDocumentRecord = typeof knowledgeDocuments.$inferSelect;
export type NewKnowledgeDocumentRecord = typeof knowledgeDocuments.$inferInsert;
export type KnowledgeChunkRecord = typeof knowledgeChunks.$inferSelect;
export type NewKnowledgeChunkRecord = typeof knowledgeChunks.$inferInsert;
