import { Controller, type INestMicroservice, Module } from '@nestjs/common';
import { type ClientProxy, MessagePattern, Payload } from '@nestjs/microservices';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  createE2eSignedHeaders,
  createTcpMicroserviceTestClient,
  expectRpcErrorStatus,
  startMockTcpMicroservice,
} from '@semcache/shared-config/testing';
import type {
  DeleteKnowledgeDocumentResponseDto,
  KnowledgeDocumentDetailResponseDto,
  LlmGenerateEmbeddingsResponseDto,
  RetrieveKnowledgeContextResponseDto,
} from '@semcache/shared-dtos';
import {
  KnowledgeDocumentStatus,
  QueryCategory,
  SERVICE_TCP_PATTERNS,
  ServiceName,
  UserRole,
} from '@semcache/shared-types';
import { firstValueFrom, of } from 'rxjs';
import { AppModule } from '../src/app.module';
import { KB_PG_POOL } from '../src/db/database.module';
import { KnowledgeBaseRepository } from '../src/knowledge-base/knowledge-base.repository';
import { SEMANTIC_CACHE_SERVICE_CLIENT } from '../src/knowledge-base/knowledge-base.service';
import {
  InMemoryKnowledgeBaseRepository,
  embedTextDeterministic,
} from './in-memory-knowledge-base.repository';

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

describe('Knowledge Base Service (TCP e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  let mockLlmApp: INestMicroservice;
  let cacheSendMock: jest.Mock;
  const originalEnv = { ...process.env };
  const secret = 'test-internal-service-secret-32-chars';

  beforeAll(async () => {
    let llmPort: number;
    ({ app: mockLlmApp, port: llmPort } = await startMockTcpMicroservice(MockLlmEmbeddingModule));

    process.env.NODE_ENV = 'test';
    process.env.INTERNAL_SERVICE_SECRET = secret;
    process.env.LLM_SERVICE_HOST = '127.0.0.1';
    process.env.LLM_SERVICE_PORT = String(llmPort);

    cacheSendMock = jest.fn(() => of({ invalidatedCount: 0, scope: 'unlinked' }));

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(KnowledgeBaseRepository)
      .useClass(InMemoryKnowledgeBaseRepository)
      .overrideProvider(KB_PG_POOL)
      .useValue({ end: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(SEMANTIC_CACHE_SERVICE_CLIENT)
      .useValue({ send: cacheSendMock, close: jest.fn().mockResolvedValue(undefined) })
      .compile();

    ({ app, client } = await createTcpMicroserviceTestClient(moduleFixture));
  });

  afterAll(async () => {
    await client.close();
    await app.close();
    await mockLlmApp.close();
    process.env = { ...originalEnv };
  });

  function createHeaders(role: UserRole) {
    return createE2eSignedHeaders(role, 'sess-kb-e2e', secret);
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
    await expectRpcErrorStatus(client, SERVICE_TCP_PATTERNS.KB_DOCUMENTS_LIST, { headers: {} }, 401);
    await expectRpcErrorStatus(
      client,
      SERVICE_TCP_PATTERNS.KB_DOCUMENTS_UPLOAD,
      {
        headers: createHeaders(UserRole.CUSTOMER),
        body: { title: 'Test', content: 'Content' },
      },
      403,
    );
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
    expect(cacheSendMock).toHaveBeenCalledWith(SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_UNLINKED, {
      headers: adminHeaders,
    });

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
    expect(cacheSendMock).toHaveBeenCalledWith(SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_BY_SOURCES, {
      headers: adminHeaders,
      body: { documentIds: [uploaded.id] },
    });
  });
});
