import type { INestApplication } from '@nestjs/common';
import { FakeModel, overrideModels } from '@nestjs/ai/testing';
import { Test, type TestingModule } from '@nestjs/testing';
import { ChatMessageRole, ServiceName } from '@semcache/shared-types';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('LLM Service (e2e)', () => {
  let app: INestApplication<App>;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_DEFAULT_MODEL = 'openrouter/free';

    const moduleFixture: TestingModule = await overrideModels(
      Test.createTestingModule({
        imports: [AppModule],
      }),
      {
        default: new FakeModel(() => ({
          text: 'Mocked free assistant response',
          usage: { inputTokens: 15, outputTokens: 7 },
        })),
      },
    ).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    process.env = { ...originalEnv };
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          service: ServiceName.LLM_SERVICE,
          status: 'ok',
          timestamp: expect.any(String),
        });
      });
  });

  it('/llm/chat (POST) returns completion for free OpenRouter model', async () => {
    const res = await request(app.getHttpServer())
      .post('/llm/chat')
      .send({
        model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        messages: [
          { role: ChatMessageRole.SYSTEM, content: 'You are a helpful support assistant.' },
          { role: ChatMessageRole.USER, content: 'How do I reset my password?' },
        ],
      })
      .expect(200);

    expect(res.body).toEqual({
      content: 'Mocked free assistant response',
      model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      latencyMs: expect.any(Number),
      usage: {
        promptTokens: 15,
        completionTokens: 7,
        totalTokens: 22,
      },
    });
  });

  it('/llm/chat (POST) rejects paid models with 400 Bad Request', async () => {
    const res = await request(app.getHttpServer())
      .post('/llm/chat')
      .send({
        model: 'openai/gpt-4o',
        messages: [{ role: ChatMessageRole.USER, content: 'Hi' }],
      })
      .expect(400);

    expect(JSON.stringify(res.body)).toContain('Only free OpenRouter models');
  });
});
