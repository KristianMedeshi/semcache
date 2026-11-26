import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import {
  KnowledgeDocumentFormat,
  KnowledgeDocumentStatus,
  QueryCategory,
  SERVICE_TCP_PATTERNS,
} from '@semcache/shared-types';
import { of, throwError } from 'rxjs';
import { InMemoryKnowledgeBaseRepository } from '../../test/in-memory-knowledge-base.repository';
import { DocumentProcessorService } from './document-processor.service';
import type { KnowledgeBaseRepository } from './knowledge-base.repository';
import { KnowledgeBaseService } from './knowledge-base.service';

function createKnowledgeBaseHarness(options?: {
  embeddingSendImpl?: jest.Mock;
  cacheSendImpl?: jest.Mock;
}) {
  const mockRepo = new InMemoryKnowledgeBaseRepository();
  const spyRepo: Partial<KnowledgeBaseRepository> = {
    createDocument: jest.fn((input) => mockRepo.createDocument(input)),
    updateDocumentStatus: jest.fn((id, updates) => mockRepo.updateDocumentStatus(id, updates)),
    updateDocumentContent: jest.fn((id, updates) => mockRepo.updateDocumentContent(id, updates)),
    replaceDocumentChunks: jest.fn((docId, chunks) =>
      mockRepo.replaceDocumentChunks(docId, chunks),
    ),
    findAllDocuments: jest.fn(() => mockRepo.findAllDocuments()),
    findDocumentById: jest.fn((id) => mockRepo.findDocumentById(id)),
    findChunksByDocumentId: jest.fn((id) => mockRepo.findChunksByDocumentId(id)),
    deleteDocument: jest.fn((id) => mockRepo.deleteDocument(id)),
    searchSimilarChunks: jest.fn(async () => {
      const firstDoc = [...mockRepo.docs.values()].find(
        (d) => d.status === KnowledgeDocumentStatus.READY,
      );
      if (!firstDoc) {
        return [];
      }
      return mockRepo.searchSimilarChunks({
        queryEmbedding: mockRepo.chunksByDoc.get(firstDoc.id)?.[0]?.embedding ?? [],
        topK: 4,
        minSimilarity: -1,
      });
    }),
  };

  const embeddingSendMock =
    options?.embeddingSendImpl ??
    jest.fn((_pattern: string, payload: { texts: string[] }) =>
      of({
        embeddings: payload.texts.map(() => Array.from({ length: 384 }, () => 0.05)),
        model: 'local/deterministic-384',
        dimensions: 384,
        latencyMs: 5,
        usage: { totalTokens: 20 },
      }),
    );

  const embeddingClient = { send: embeddingSendMock } as unknown as ClientProxy;
  const cacheSendMock =
    options?.cacheSendImpl ??
    jest.fn(() => of({ invalidatedCount: 1, scope: 'sources', documentIds: [] }));
  const semanticCacheClient = { send: cacheSendMock } as unknown as ClientProxy;
  const processor = new DocumentProcessorService();
  const service = new KnowledgeBaseService(
    spyRepo as KnowledgeBaseRepository,
    processor,
    embeddingClient,
    undefined,
    semanticCacheClient,
  );

  return {
    service,
    mockRepo: spyRepo,
    embeddingSendMock,
    cacheSendMock,
    docs: mockRepo.docs,
    chunksByDoc: mockRepo.chunksByDoc,
  };
}

describe('KnowledgeBaseService', () => {
  it('uploads, extracts, chunks, embeds, and marks a document as READY', async () => {
    const { service, embeddingSendMock } = createKnowledgeBaseHarness();

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
    expect(embeddingSendMock).toHaveBeenCalledWith(SERVICE_TCP_PATTERNS.EMBEDDINGS_GENERATE, {
      texts: [expect.stringContaining('Scan the QR code')],
    });
  });

  it('tracks FAILED status and errorMessage when embedding generation fails, and recovers on reprocess', async () => {
    const embeddingSendMock = jest
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('Embedding TCP timeout')))
      .mockReturnValueOnce(
        of({
          embeddings: [Array.from({ length: 384 }, () => 0.05)],
          model: 'local/deterministic-384',
          dimensions: 384,
          latencyMs: 4,
          usage: { totalTokens: 10 },
        }),
      );

    const { service } = createKnowledgeBaseHarness({ embeddingSendImpl: embeddingSendMock });

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

  it('notifies semantic-cache-service on upload, reprocess, and delete, and tolerates cache errors', async () => {
    const cacheSendMock = jest
      .fn()
      .mockReturnValueOnce(of({ invalidatedCount: 2, scope: 'unlinked' }))
      .mockReturnValueOnce(of({ invalidatedCount: 1, scope: 'sources' }))
      .mockReturnValueOnce(of({ invalidatedCount: 0, scope: 'unlinked' }))
      .mockReturnValueOnce(throwError(() => new Error('Cache TCP unavailable')));

    const { service } = createKnowledgeBaseHarness({ cacheSendImpl: cacheSendMock });
    const adminHeaders = { 'x-internal-user-id': 'admin-1' };

    const doc = await service.uploadDocument(
      {
        title: 'Roaming Guide',
        content: '25 GB EU roaming included.',
      },
      'admin-1',
      adminHeaders,
    );
    expect(cacheSendMock).toHaveBeenNthCalledWith(
      1,
      SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_UNLINKED,
      {
        headers: adminHeaders,
      },
    );

    await service.reprocessDocument(doc.id, undefined, adminHeaders);
    expect(cacheSendMock).toHaveBeenNthCalledWith(
      2,
      SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_BY_SOURCES,
      {
        headers: adminHeaders,
        body: { documentIds: [doc.id] },
      },
    );
    expect(cacheSendMock).toHaveBeenNthCalledWith(
      3,
      SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_UNLINKED,
      {
        headers: adminHeaders,
      },
    );

    const deleted = await service.deleteDocument(doc.id, adminHeaders);
    expect(deleted.deleted).toBe(true);
    expect(cacheSendMock).toHaveBeenNthCalledWith(
      4,
      SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_BY_SOURCES,
      {
        headers: adminHeaders,
        body: { documentIds: [doc.id] },
      },
    );
    expect(cacheSendMock).toHaveBeenCalledTimes(4);
  });

  it('skips unlinked cache invalidation when upload processing fails', async () => {
    const embeddingSendMock = jest
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('Embedding service offline')));
    const cacheSendMock = jest.fn();

    const { service } = createKnowledgeBaseHarness({
      embeddingSendImpl: embeddingSendMock,
      cacheSendImpl: cacheSendMock,
    });

    const doc = await service.uploadDocument({
      title: 'Broken Doc',
      content: 'Content that fails embedding.',
    });

    expect(doc.status).toBe(KnowledgeDocumentStatus.FAILED);
    expect(cacheSendMock).not.toHaveBeenCalled();
  });
});
