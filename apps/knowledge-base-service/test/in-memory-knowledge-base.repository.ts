import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { RetrievedKnowledgeChunkDto } from '@semcache/shared-dtos';
import { KnowledgeDocumentStatus, QueryCategory } from '@semcache/shared-types';
import type { KnowledgeChunkRecord, KnowledgeDocumentRecord } from '../src/db/schema';

export function embedTextDeterministic(text: string): number[] {
  const vector = Array.from({ length: 384 }, () => 0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  for (const token of tokens) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    const idx = hash % 384;
    vector[idx] = (vector[idx] ?? 0) + 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return dot;
}

@Injectable()
export class InMemoryKnowledgeBaseRepository {
  readonly docs = new Map<string, KnowledgeDocumentRecord>();
  readonly chunksByDoc = new Map<string, KnowledgeChunkRecord[]>();

  async createDocument(input: {
    title: string;
    fileName?: string;
    format: string;
    category: string;
    rawContent: string;
    metadata?: Record<string, string | number | boolean>;
    uploadedBy?: string;
    status?: string;
  }): Promise<KnowledgeDocumentRecord> {
    const now = new Date();
    const record: KnowledgeDocumentRecord = {
      id: randomUUID(),
      title: input.title,
      fileName: input.fileName ?? null,
      format: input.format as KnowledgeDocumentRecord['format'],
      category: input.category as KnowledgeDocumentRecord['category'],
      rawContent: input.rawContent,
      extractedContent: '',
      status: (input.status ??
        KnowledgeDocumentStatus.PENDING) as KnowledgeDocumentRecord['status'],
      chunkCount: 0,
      characterCount: 0,
      errorMessage: null,
      metadata: input.metadata ?? {},
      uploadedBy: input.uploadedBy ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.docs.set(record.id, record);
    return record;
  }

  async updateDocumentStatus(
    documentId: string,
    updates: {
      status: KnowledgeDocumentStatus;
      format?: KnowledgeDocumentRecord['format'];
      extractedContent?: string;
      chunkCount?: number;
      characterCount?: number;
      errorMessage?: string | null;
    },
  ): Promise<KnowledgeDocumentRecord> {
    const existing = this.docs.get(documentId);
    if (!existing) {
      throw new Error('Document not found');
    }
    const updated: KnowledgeDocumentRecord = {
      ...existing,
      status: updates.status,
      format: updates.format ?? existing.format,
      extractedContent: updates.extractedContent ?? existing.extractedContent,
      chunkCount: updates.chunkCount ?? existing.chunkCount,
      characterCount: updates.characterCount ?? existing.characterCount,
      errorMessage:
        updates.errorMessage !== undefined ? updates.errorMessage : existing.errorMessage,
      updatedAt: new Date(),
    };
    this.docs.set(documentId, updated);
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
    const existing = this.docs.get(documentId);
    if (!existing) {
      throw new Error('Document not found');
    }
    const updated: KnowledgeDocumentRecord = {
      ...existing,
      ...(updates.rawContent !== undefined ? { rawContent: updates.rawContent } : {}),
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.metadata !== undefined ? { metadata: updates.metadata } : {}),
      updatedAt: new Date(),
    };
    this.docs.set(documentId, updated);
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
    const now = new Date();
    const records: KnowledgeChunkRecord[] = chunks.map((chunk) => ({
      id: randomUUID(),
      documentId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      characterCount: chunk.characterCount,
      embedding: chunk.embedding,
      metadata: chunk.metadata,
      createdAt: now,
    }));
    this.chunksByDoc.set(documentId, records);
    return records;
  }

  async findAllDocuments(): Promise<KnowledgeDocumentRecord[]> {
    return [...this.docs.values()];
  }

  async findDocumentById(documentId: string): Promise<KnowledgeDocumentRecord | null> {
    return this.docs.get(documentId) ?? null;
  }

  async findChunksByDocumentId(documentId: string): Promise<KnowledgeChunkRecord[]> {
    return this.chunksByDoc.get(documentId) ?? [];
  }

  async deleteDocument(
    documentId: string,
  ): Promise<{ deleted: boolean; deletedChunksCount: number }> {
    const deleted = this.docs.delete(documentId);
    const deletedChunksCount = this.chunksByDoc.get(documentId)?.length ?? 0;
    this.chunksByDoc.delete(documentId);
    return { deleted, deletedChunksCount };
  }

  async searchSimilarChunks(params: {
    queryEmbedding: number[];
    topK: number;
    minSimilarity: number;
    category?: QueryCategory;
  }): Promise<RetrievedKnowledgeChunkDto[]> {
    const matches: RetrievedKnowledgeChunkDto[] = [];

    for (const doc of this.docs.values()) {
      if (doc.status !== KnowledgeDocumentStatus.READY) {
        continue;
      }
      if (params.category && doc.category !== params.category) {
        continue;
      }
      for (const chunk of this.chunksByDoc.get(doc.id) ?? []) {
        const sim = Number(cosineSim(params.queryEmbedding, chunk.embedding).toFixed(4));
        if (sim >= params.minSimilarity) {
          matches.push({
            chunkId: chunk.id,
            documentId: doc.id,
            documentTitle: doc.title,
            fileName: doc.fileName,
            category: doc.category as QueryCategory,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            similarity: sim,
            source: {
              documentId: doc.id,
              documentTitle: doc.title,
              fileName: doc.fileName,
              category: doc.category as QueryCategory,
              chunkId: chunk.id,
              chunkIndex: chunk.chunkIndex,
            },
          });
        }
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity).slice(0, params.topK);
  }
}
