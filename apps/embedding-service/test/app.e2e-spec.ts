import type { INestMicroservice } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { Test, type TestingModule } from '@nestjs/testing';
import { extractRpcErrorPayload } from '@semcache/shared-config';
import { createTcpMicroserviceTestClient } from '@semcache/shared-config/testing';
import { SERVICE_TCP_PATTERNS, ServiceName } from '@semcache/shared-types';
import { firstValueFrom } from 'rxjs';
import { AppModule } from '../src/app.module';

describe('Embedding Service (TCP e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    ({ app, client } = await createTcpMicroserviceTestClient(moduleFixture));
  });

  afterEach(async () => {
    await client.close();
    await app.close();
    process.env = { ...originalEnv };
  });

  it('app.health returns ServiceName.EMBEDDING_SERVICE health status', async () => {
    const res = await firstValueFrom(client.send(SERVICE_TCP_PATTERNS.APP_HEALTH, {}));
    expect(res).toEqual({
      service: ServiceName.EMBEDDING_SERVICE,
      status: 'ok',
      timestamp: expect.any(String),
    });
  });

  it('embeddings.generate returns normalized 384-dim embeddings over TCP', async () => {
    const res = await firstValueFrom(
      client.send(SERVICE_TCP_PATTERNS.EMBEDDINGS_GENERATE, {
        texts: ['eSIM QR code activation guide', 'Monthly billing cycle'],
      }),
    );

    expect(res).toEqual({
      embeddings: [expect.any(Array), expect.any(Array)],
      model: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
      dimensions: 384,
      latencyMs: expect.any(Number),
      usage: { totalTokens: expect.any(Number) },
    });
    expect(res.embeddings[0]).toHaveLength(384);
  }, 60_000);

  it('embeddings.generate rejects empty texts with 400 Bad Request RPC error', async () => {
    let caughtError: unknown;
    try {
      await firstValueFrom(
        client.send(SERVICE_TCP_PATTERNS.EMBEDDINGS_GENERATE, {
          texts: [],
        }),
      );
    } catch (error) {
      caughtError = error;
    }

    expect(extractRpcErrorPayload(caughtError)?.statusCode).toBe(400);
  });
});
