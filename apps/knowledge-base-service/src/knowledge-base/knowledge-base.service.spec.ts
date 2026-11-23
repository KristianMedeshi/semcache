import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import type { RetrievedKnowledgeChunkDto } from '@semcache/shared-dtos';
import {
  KnowledgeDocumentFormat,
  KnowledgeDocumentStatus,
  QueryCategory,
  SERVICE_TCP_PATTERNS,
} from '@semcache/shared-types';
import { of, throwError } from 'rxjs';
import type { KnowledgeChunkRecord, KnowledgeDocumentRecord } from '../db/schema';
import { DocumentProcessorService } from './document-processor.service';
import type { KnowledgeBaseRepository } from './knowledge-base.repository';
import { KnowledgeBaseService } from './knowledge-base.service';

function createKnowledgeBaseHarness(options?: { llmSendImpl?: jest.Mock }) {
  const docs = new Map<string, KnowledgeDocumentRecord>();
  const chunksByDoc = new Map<string, KnowledgeChunkRecord[]>();

  const mockRepo: Partial<KnowledgeBaseRepository> = {
    createDocument: jest.fn(async (input) => {
      const now = new Date();
      const record: KnowledgeDocumentRecord = {
        id: randomUUID(),
        title: input.title,
        fileName: input.fileName ?? null,
        format: input.format,
        category: input.category,
        rawContent: input.rawContent,
        extractedContent: '',
        status: input.status ?? KnowledgeDocumentStatus.PENDING,
        chunkCount: 0,
        characterCount: 0,
        errorMessage: null,
        metadata: input.metadata ?? {},
        uploadedBy: input.uploadedBy ?? null,
        createdAt: now,
        updatedAt: now,
      };
      docs.set(record.id, record);
      return record;
    }),
    updateDocumentStatus: jest.fn(async (id, updates) => {
      const existing = docs.get(id);
      if (!existing) {
        throw new Error('Not found');
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
      docs.set(id, updated);
      return updated;
    }),
    replaceDocumentChunks: jest.fn(async (docId, chunks) => {
      const now = new Date();
      const records: KnowledgeChunkRecord[] = chunks.map((chunk) => ({
        id: randomUUID(),
        documentId: docId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        characterCount: chunk.characterCount,
        embedding: chunk.embedding,
        metadata: chunk.metadata,
        createdAt: now,
      }));
      chunksByDoc.set(docId, records);
      return records;
    }),
    findAllDocuments: jest.fn(async () => [...docs.values()]),
    findDocumentById: jest.fn(async (id) => docs.get(id) ?? null),
    findChunksByDocumentId: jest.fn(async (id) => chunksByDoc.get(id) ?? []),
    deleteDocument: jest.fn(async (id) => {
      const existed = docs.delete(id);
      const removedChunks = chunksByDoc.get(id)?.length ?? 0;
      chunksByDoc.delete(id);
      return { deleted: existed, deletedChunksCount: removedChunks };
    }),
    searchSimilarChunks: jest.fn(async (): Promise<RetrievedKnowledgeChunkDto[]> => {
      const firstDoc = [...docs.values()].find((d) => d.status === KnowledgeDocumentStatus.READY);
      if (!firstDoc) {
        return [];
      }
      const docChunks = chunksByDoc.get(firstDoc.id) ?? [];
      const firstChunk = docChunks[0];
      if (!firstChunk) {
        return [];
      }
      return [
        {
          chunkId: firstChunk.id,
          documentId: firstDoc.id,
          documentTitle: firstDoc.title,
          fileName: firstDoc.fileName,
          category: firstDoc.category as QueryCategory,
          chunkIndex: firstChunk.chunkIndex,
          content: firstChunk.content,
          similarity: 0.91,
          source: {
            documentId: firstDoc.id,
            documentTitle: firstDoc.title,
            fileName: firstDoc.fileName,
            category: firstDoc.category as QueryCategory,
            chunkId: firstChunk.id,
            chunkIndex: firstChunk.chunkIndex,
          },
        },
      ];
    }),
  };

  const llmSendMock =
    options?.llmSendImpl ??
    jest.fn((_pattern: string, payload: { texts: string[] }) =>
      of({
        embeddings: payload.texts.map(() => new Array(384).fill(0.05)),
        model: 'local/deterministic-384',
        dimensions: 384,
        latencyMs: 5,
        usage: { totalTokens: 20 },
      }),
    );

  const llmClient = { send: llmSendMock } as unknown as ClientProxy;
  const processor = new DocumentProcessorService();
  const service = new KnowledgeBaseService(
    mockRepo as KnowledgeBaseRepository,
    processor,
    llmClient,
  );

  return { service, mockRepo, llmSendMock, docs, chunksByDoc };
}

describe('KnowledgeBaseService', () => {
  it('uploads, extracts, chunks, embeds, and marks a document as READY', async () => {
    const { service, llmSendMock } = createKnowledgeBaseHarness();

    const doc = await service.uploadDocument(
      {
        title: 'eSIM Activation Guide',
        fileName: 'esim-guide.md',
        category: QueryCategory.TECHNICAL_SUPPORT,
        content: '# eSIM Setup\n\nScan the QR code in Settings > Cellular > Add eSIM.',
      },
      '11111111-1111-4111-8111-111111111111',
    );

    expect(doc.status).toBe(KnowledgeDocumentStatus.READY);
    expect(doc.format).toBe(KnowledgeDocumentFormat.MARKDOWN);
    expect(doc.chunkCount).toBe(1);
    expect(doc.chunks).toHaveLength(1);
    expect(doc.errorMessage).toBeNull();
    expect(llmSendMock).toHaveBeenCalledWith(SERVICE_TCP_PATTERNS.LLM_EMBEDDINGS, {
      texts: [expect.stringContaining('Scan the QR code')],
    });
  });

  it('tracks FAILED status and errorMessage when embedding generation fails, and recovers on reprocess', async () => {
    const llmSendMock = jest
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('Embedding TCP timeout')))
      .mockReturnValueOnce(
        of({
          embeddings: [new Array(384).fill(0.05)],
          model: 'local/deterministic-384',
          dimensions: 384,
          latencyMs: 4,
          usage: { totalTokens: 10 },
        }),
      );

    const { service } = createKnowledgeBaseHarness({ llmSendImpl: llmSendMock });

    const failedDoc = await service.uploadDocument({
      title: 'Billing FAQ',
      content: 'Invoices are generated on the 1st of every month.',
    });

    expect(failedDoc.status).toBe(KnowledgeDocumentStatus.FAILED);
    expect(failedDoc.chunkCount).toBe(0);
    expect(failedDoc.errorMessage).toContain('Embedding TCP timeout');

    const recoveredDoc = await service.reprocessDocument(failedDoc.id);
    expect(recoveredDoc.status).toBe(KnowledgeDocumentStatus.READY);
    expect(recoveredDoc.chunkCount).toBe(1);
    expect(recoveredDoc.errorMessage).toBeNull();
  });

  it('retrieves semantic context with formatted sources and deletes documents with chunks', async () => {
    const { service } = createKnowledgeBaseHarness();

    const doc = await service.uploadDocument({
      title: '5G Plans',
      content: 'The 5G Unlimited Plan costs 35 EUR/month with 25 GB EU roaming.',
      category: QueryCategory.PRODUCT_INQUIRY,
    });

    const context = await service.retrieveContext({
      query: 'How much does 5G Unlimited cost?',
    });

    expect(context.hasRelevantContext).toBe(true);
    expect(context.results).toHaveLength(1);
    expect(context.sources[0]?.documentTitle).toBe('5G Plans');
    expect(context.formattedContext).toContain('[Source 1: 5G Plans');

    const deleted = await service.deleteDocument(doc.id);
    expect(deleted).toEqual({
      id: doc.id,
      deleted: true,
      deletedChunksCount: 1,
    });

    await expect(service.getDocument(doc.id)).rejects.toThrow(NotFoundException);
  });

  it('rejects invalid chunkOverlap >= chunkSize and empty search queries', async () => {
    const { service } = createKnowledgeBaseHarness();

    await expect(
      service.uploadDocument({
        title: 'Bad chunk config',
        content: 'Some content',
        chunkSize: 200,
        chunkOverlap: 200,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(service.retrieveContext({ query: '   ' })).rejects.toThrow(BadRequestException);
  });
});
