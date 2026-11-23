import { randomUUID } from 'node:crypto';
import type { AddressInfo, Server } from 'node:net';
import { Controller, type INestMicroservice, Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  ClientProxy,
  ClientProxyFactory,
  MessagePattern,
  type MicroserviceOptions,
  Payload,
  Transport,
} from '@nestjs/microservices';
import { Test, type TestingModule } from '@nestjs/testing';
import { createSignedInternalHeaders, extractRpcErrorPayload } from '@semcache/shared-config';
import type {
  DeleteKnowledgeDocumentResponseDto,
  KnowledgeDocumentDetailResponseDto,
  LlmGenerateEmbeddingsResponseDto,
  RetrieveKnowledgeContextResponseDto,
  RetrievedKnowledgeChunkDto,
} from '@semcache/shared-dtos';
import {
  KnowledgeDocumentStatus,
  QueryCategory,
  SERVICE_TCP_PATTERNS,
  ServiceName,
  UserRole,
} from '@semcache/shared-types';
import { firstValueFrom } from 'rxjs';
import { AppModule } from '../src/app.module';
import { KB_PG_POOL } from '../src/db/database.module';
import type { KnowledgeChunkRecord, KnowledgeDocumentRecord } from '../src/db/schema';
import { KnowledgeBaseRepository } from '../src/knowledge-base/knowledge-base.repository';

function embedTextDeterministic(text: string): number[] {
  const vector = new Array<number>(384).fill(0);
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

function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return dot;
}

@Controller()
class MockLlmEmbeddingController {
  @MessagePattern(SERVICE_TCP_PATTERNS.LLM_EMBEDDINGS)
  embed(@Payload() payload: { texts: string[] }): LlmGenerateEmbeddingsResponseDto {
    return {
      embeddings: payload.texts.map(embedTextDeterministic),
      model: 'local/deterministic-384',
      dimensions: 384,
      latencyMs: 3,
      usage: { totalTokens: payload.texts.length * 10 },
    };
  }
}

@Module({
  controllers: [MockLlmEmbeddingController],
})
class MockLlmEmbeddingModule {}

@Injectable()
class InMemoryKnowledgeBaseRepository {
  private readonly docs = new Map<string, KnowledgeDocumentRecord>();
  private readonly chunksByDoc = new Map<string, KnowledgeChunkRecord[]>();

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

describe('Knowledge Base Service (TCP e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  let mockLlmApp: INestMicroservice;
  const originalEnv = { ...process.env };
  const secret = 'test-internal-service-secret-32-chars';

  beforeAll(async () => {
    mockLlmApp = await NestFactory.createMicroservice<MicroserviceOptions>(MockLlmEmbeddingModule, {
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 0 },
      logger: false,
    });
    await mockLlmApp.listen();
    const llmAddress = mockLlmApp.unwrap<Server>().address() as AddressInfo;

    process.env.NODE_ENV = 'test';
    process.env.INTERNAL_SERVICE_SECRET = secret;
    process.env.LLM_SERVICE_HOST = '127.0.0.1';
    process.env.LLM_SERVICE_PORT = String(llmAddress.port);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(KnowledgeBaseRepository)
      .useClass(InMemoryKnowledgeBaseRepository)
      .overrideProvider(KB_PG_POOL)
      .useValue({ end: jest.fn().mockResolvedValue(undefined) })
      .compile();

    app = moduleFixture.createNestMicroservice<MicroserviceOptions>({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 0 },
    });
    await app.listen();

    const address = app.unwrap<Server>().address() as AddressInfo;
    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: address.port },
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
    await app.close();
    await mockLlmApp.close();
    process.env = { ...originalEnv };
  });

  function createHeaders(role: UserRole) {
    return createSignedInternalHeaders(
      {
        id: '11111111-1111-4111-8111-111111111111',
        email: role === UserRole.ADMIN ? 'admin@example.com' : 'customer@example.com',
        role,
        sessionId: 'sess-kb-e2e',
      },
      secret,
    );
  }

  it('app.health returns ServiceName.KNOWLEDGE_BASE_SERVICE health status', async () => {
    const res = await firstValueFrom(client.send(SERVICE_TCP_PATTERNS.APP_HEALTH, {}));
    expect(res).toEqual({
      service: ServiceName.KNOWLEDGE_BASE_SERVICE,
      status: 'ok',
      timestamp: expect.any(String),
    });
  });

  it('enforces RBAC: rejects unauthenticated and customer document uploads, allows admin', async () => {
    let unauthErr: unknown;
    try {
      await firstValueFrom(client.send(SERVICE_TCP_PATTERNS.KB_DOCUMENTS_LIST, { headers: {} }));
    } catch (error) {
      unauthErr = error;
    }
    expect(extractRpcErrorPayload(unauthErr)?.statusCode).toBe(401);

    let customerErr: unknown;
    try {
      await firstValueFrom(
        client.send(SERVICE_TCP_PATTERNS.KB_DOCUMENTS_UPLOAD, {
          headers: createHeaders(UserRole.CUSTOMER),
          body: { title: 'Test', content: 'Content' },
        }),
      );
    } catch (error) {
      customerErr = error;
    }
    expect(extractRpcErrorPayload(customerErr)?.statusCode).toBe(403);
  });

  it('uploads, chunks, embeds, searches, and deletes knowledge base documents over TCP', async () => {
    const adminHeaders = createHeaders(UserRole.ADMIN);

    const uploaded = await firstValueFrom(
      client.send<KnowledgeDocumentDetailResponseDto>(SERVICE_TCP_PATTERNS.KB_DOCUMENTS_UPLOAD, {
        headers: adminHeaders,
        body: {
          title: 'SemCache Roaming Policy',
          fileName: 'roaming.md',
          category: QueryCategory.PRODUCT_INQUIRY,
          content:
            '# EU Roaming\n\nSemCache 5G Unlimited includes 25 GB EU roaming data per month at no extra charge.',
        },
      }),
    );

    expect(uploaded.status).toBe(KnowledgeDocumentStatus.READY);
    expect(uploaded.chunkCount).toBe(1);

    const searchResult = await firstValueFrom(
      client.send<RetrieveKnowledgeContextResponseDto>(SERVICE_TCP_PATTERNS.KB_CONTEXT_RETRIEVE, {
        body: {
          query: 'EU roaming data 5G Unlimited',
          minSimilarity: 0.1,
        },
      }),
    );

    expect(searchResult.hasRelevantContext).toBe(true);
    expect(searchResult.results[0]?.documentTitle).toBe('SemCache Roaming Policy');
    expect(searchResult.sources[0]?.fileName).toBe('roaming.md');

    const deleted = await firstValueFrom(
      client.send<DeleteKnowledgeDocumentResponseDto>(SERVICE_TCP_PATTERNS.KB_DOCUMENTS_DELETE, {
        headers: adminHeaders,
        documentId: uploaded.id,
      }),
    );
    expect(deleted).toEqual({
      id: uploaded.id,
      deleted: true,
      deletedChunksCount: 1,
    });
  });
});
