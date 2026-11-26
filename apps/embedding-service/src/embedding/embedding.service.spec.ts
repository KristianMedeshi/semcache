import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { SharedConfigModule } from '@semcache/shared-config';
import { embeddingEnvSchema } from '../config/embedding.env';
import { EmbeddingModule } from './embedding.module';
import { EmbeddingService } from './embedding.service';

describe('EmbeddingService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  async function createEmbeddingTestService(): Promise<{
    service: EmbeddingService;
    moduleRef: TestingModule;
  }> {
    process.env.NODE_ENV = 'test';

    const moduleRef = await Test.createTestingModule({
      imports: [
        SharedConfigModule.forRoot({ schema: embeddingEnvSchema, ignoreEnvFile: true }),
        EmbeddingModule,
      ],
    }).compile();

    return { service: moduleRef.get(EmbeddingService), moduleRef };
  }

  it('generates 384-dimensional normalized embeddings via generateEmbeddings', async () => {
    const { service, moduleRef } = await createEmbeddingTestService();
    const res = await service.generateEmbeddings({
      texts: ['5G Unlimited Plan details', 'International roaming rates'],
    });

    expect(res.embeddings).toHaveLength(2);
    expect(res.dimensions).toBe(384);
    expect(res.embeddings[0]).toHaveLength(384);
    expect(res.embeddings[1]).toHaveLength(384);
    expect(res.model).toBe('Xenova/paraphrase-multilingual-MiniLM-L12-v2');
    expect(res.usage.totalTokens).toBeGreaterThan(0);
    await moduleRef.close();
  }, 30_000);

  it('rejects empty texts array with BadRequestException', async () => {
    const { service, moduleRef } = await createEmbeddingTestService();
    await expect(service.generateEmbeddings({ texts: [] })).rejects.toThrow(BadRequestException);
    await moduleRef.close();
  });
});
