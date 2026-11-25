import type { AddressInfo, Server } from 'node:net';
import { Controller, type INestMicroservice, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  type ClientProxy,
  MessagePattern,
  type MicroserviceOptions,
  Payload,
  Transport,
} from '@nestjs/microservices';
import { Test, type TestingModule } from '@nestjs/testing';
import { extractRpcErrorPayload } from '@semcache/shared-config';
import {
  createE2eSignedHeaders,
  createTcpMicroserviceTestClient,
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
import { firstValueFrom } from 'rxjs';
import { AppModule } from '../src/app.module';
import { KB_PG_POOL } from '../src/db/database.module';
import { KnowledgeBaseRepository } from '../src/knowledge-base/knowledge-base.repository';
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
