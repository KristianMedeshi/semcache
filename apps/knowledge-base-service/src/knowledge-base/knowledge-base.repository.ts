import { Inject, Injectable } from '@nestjs/common';
import type {
  KnowledgeChunkResponseDto,
  KnowledgeDocumentResponseDto,
  ListKnowledgeDocumentsQueryDto,
  RetrievedKnowledgeChunkDto,
} from '@semcache/shared-dtos';
import {
  KnowledgeDocumentFormat,
  KnowledgeDocumentStatus,
  QueryCategory,
} from '@semcache/shared-types';
import { and, asc, cosineDistance, desc, eq, gte, sql } from 'drizzle-orm';
import { KB_DRIZZLE, type KnowledgeBaseDatabase } from '../db/database.module';
import {
  type KnowledgeChunkRecord,
  type KnowledgeDocumentRecord,
  knowledgeChunks,
  knowledgeDocuments,
} from '../db/schema';

export function toKnowledgeDocumentResponseDto(
  record: KnowledgeDocumentRecord,
): KnowledgeDocumentResponseDto {
  return {
    id: record.id,
    title: record.title,
    fileName: record.fileName ?? null,
    format: record.format as KnowledgeDocumentFormat,
    category: record.category as QueryCategory,
    status: record.status as KnowledgeDocumentStatus,
    chunkCount: record.chunkCount,
    characterCount: record.characterCount,
    errorMessage: record.errorMessage ?? null,
    metadata: record.metadata ?? {},
    uploadedBy: record.uploadedBy ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toKnowledgeChunkResponseDto(
  record: KnowledgeChunkRecord,
): KnowledgeChunkResponseDto {
  return {
    id: record.id,
    documentId: record.documentId,
    chunkIndex: record.chunkIndex,
    content: record.content,
    tokenCount: record.tokenCount,
    characterCount: record.characterCount,
    metadata: record.metadata ?? {},
    createdAt: record.createdAt.toISOString(),
  };
}

@Injectable()
export class KnowledgeBaseRepository {
  constructor(@Inject(KB_DRIZZLE) private readonly db: KnowledgeBaseDatabase) {}

  async createDocument(input: {
    title: string;
    fileName?: string;
    format: KnowledgeDocumentFormat;
    category: QueryCategory;
    rawContent: string;
    metadata?: Record<string, string | number | boolean>;
    uploadedBy?: string;
    status?: KnowledgeDocumentStatus;
  }): Promise<KnowledgeDocumentRecord> {
    const rows = await this.db
      .insert(knowledgeDocuments)
      .values({
        title: input.title,
        fileName: input.fileName ?? null,
        format: input.format,
        category: input.category,
        rawContent: input.rawContent,
        extractedContent: '',
        status: input.status ?? KnowledgeDocumentStatus.PENDING,
        metadata: input.metadata ?? {},
        uploadedBy: input.uploadedBy ?? null,
      })
      .returning();

    const created = rows[0];
    if (!created) {
      throw new Error('Failed to create knowledge base document record');
    }
    return created;
  }

  async updateDocumentStatus(
    documentId: string,
    updates: {
      status: KnowledgeDocumentStatus;
      format?: KnowledgeDocumentFormat;
      extractedContent?: string;
      chunkCount?: number;
      characterCount?: number;
      errorMessage?: string | null;
    },
  ): Promise<KnowledgeDocumentRecord> {
    const rows = await this.db
      .update(knowledgeDocuments)
      .set({
        status: updates.status,
        ...(updates.format !== undefined ? { format: updates.format } : {}),
        ...(updates.extractedContent !== undefined
          ? { extractedContent: updates.extractedContent }
          : {}),
        ...(updates.chunkCount !== undefined ? { chunkCount: updates.chunkCount } : {}),
        ...(updates.characterCount !== undefined ? { characterCount: updates.characterCount } : {}),
        ...(updates.errorMessage !== undefined ? { errorMessage: updates.errorMessage } : {}),
        updatedAt: new Date(),
      })
      .where(eq(knowledgeDocuments.id, documentId))
      .returning();

    const updated = rows[0];
    if (!updated) {
      throw new Error(`Knowledge base document ${documentId} not found`);
    }
    return updated;
  }

  async updateDocumentContent(
    documentId: string,
    updates: {
      rawContent?: string;
      title?: string;
      metadata?: Record<string, string | number | boolean>;
    },
  ): Promise<KnowledgeDocumentRecord> {
    const rows = await this.db
      .update(knowledgeDocuments)
      .set({
        ...(updates.rawContent !== undefined ? { rawContent: updates.rawContent } : {}),
        ...(updates.title !== undefined ? { title: updates.title } : {}),
        ...(updates.metadata !== undefined ? { metadata: updates.metadata } : {}),
        updatedAt: new Date(),
      })
      .where(eq(knowledgeDocuments.id, documentId))
      .returning();

    const updated = rows[0];
    if (!updated) {
      throw new Error(`Knowledge base document ${documentId} not found`);
    }
    return updated;
  }

  async replaceDocumentChunks(
    documentId: string,
    chunks: Array<{
      chunkIndex: number;
      content: string;
      tokenCount: number;
      characterCount: number;
      embedding: number[];
      metadata: Record<string, string | number | boolean>;
    }>,
  ): Promise<KnowledgeChunkRecord[]> {
    return this.db.transaction(async (tx) => {
      await tx.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, documentId));
      if (chunks.length === 0) {
        return [];
      }

      return tx
        .insert(knowledgeChunks)
        .values(
          chunks.map((chunk) => ({
            documentId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
            characterCount: chunk.characterCount,
            embedding: chunk.embedding,
            metadata: chunk.metadata,
          })),
        )
        .returning();
    });
  }

  async findAllDocuments(
    filters?: ListKnowledgeDocumentsQueryDto,
  ): Promise<KnowledgeDocumentRecord[]> {
    const conditions = [];
    if (filters?.category) {
      conditions.push(eq(knowledgeDocuments.category, filters.category));
    }
    if (filters?.status) {
      conditions.push(eq(knowledgeDocuments.status, filters.status));
    }

    const query = this.db.select().from(knowledgeDocuments);
    const filteredQuery = conditions.length > 0 ? query.where(and(...conditions)) : query;

    return filteredQuery.orderBy(desc(knowledgeDocuments.createdAt), desc(knowledgeDocuments.id));
  }

  async findDocumentById(documentId: string): Promise<KnowledgeDocumentRecord | null> {
    const rows = await this.db
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, documentId))
      .limit(1);

    return rows[0] ?? null;
  }

  async findChunksByDocumentId(documentId: string): Promise<KnowledgeChunkRecord[]> {
    return this.db
      .select()
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.documentId, documentId))
      .orderBy(asc(knowledgeChunks.chunkIndex));
  }

  async deleteDocument(
    documentId: string,
  ): Promise<{ deleted: boolean; deletedChunksCount: number }> {
    return this.db.transaction(async (tx) => {
      const deletedChunks = await tx
        .delete(knowledgeChunks)
        .where(eq(knowledgeChunks.documentId, documentId))
        .returning({ id: knowledgeChunks.id });

      const deletedDocs = await tx
        .delete(knowledgeDocuments)
        .where(eq(knowledgeDocuments.id, documentId))
        .returning({ id: knowledgeDocuments.id });

      return {
        deleted: deletedDocs.length > 0,
        deletedChunksCount: deletedChunks.length,
      };
    });
  }

  async searchSimilarChunks(params: {
    queryEmbedding: number[];
    topK: number;
    minSimilarity: number;
    category?: QueryCategory;
  }): Promise<RetrievedKnowledgeChunkDto[]> {
    const distanceExpr = cosineDistance(knowledgeChunks.embedding, params.queryEmbedding);
    const similarityExpr = sql<number>`1 - (${distanceExpr})`;

    const conditions = [
      eq(knowledgeDocuments.status, KnowledgeDocumentStatus.READY),
      gte(similarityExpr, params.minSimilarity),
    ];
    if (params.category) {
      conditions.push(eq(knowledgeDocuments.category, params.category));
    }

    const rows = await this.db
      .select({
        chunkId: knowledgeChunks.id,
        documentId: knowledgeDocuments.id,
        documentTitle: knowledgeDocuments.title,
        fileName: knowledgeDocuments.fileName,
        category: knowledgeDocuments.category,
        chunkIndex: knowledgeChunks.chunkIndex,
        content: knowledgeChunks.content,
        similarity: similarityExpr,
      })
      .from(knowledgeChunks)
      .innerJoin(knowledgeDocuments, eq(knowledgeChunks.documentId, knowledgeDocuments.id))
      .where(and(...conditions))
      .orderBy(asc(distanceExpr))
      .limit(params.topK);

    return rows.map((row) => {
      const similarity = Number(Number(row.similarity).toFixed(4));
      const category = row.category as QueryCategory;
      return {
        chunkId: row.chunkId,
        documentId: row.documentId,
        documentTitle: row.documentTitle,
        fileName: row.fileName ?? null,
        category,
        chunkIndex: row.chunkIndex,
        content: row.content,
        similarity,
        source: {
          documentId: row.documentId,
          documentTitle: row.documentTitle,
          fileName: row.fileName ?? null,
          category,
          chunkId: row.chunkId,
          chunkIndex: row.chunkIndex,
        },
      };
    });
  }
}
