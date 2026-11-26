import type { INestMicroservice } from '@nestjs/common';
import { FakeModel, overrideModels } from '@nestjs/ai/testing';
import type { ClientProxy } from '@nestjs/microservices';
import { Test, type TestingModule } from '@nestjs/testing';
import { extractRpcErrorPayload } from '@semcache/shared-config';
import { createTcpMicroserviceTestClient } from '@semcache/shared-config/testing';
import type { LlmChatStreamEventDto } from '@semcache/shared-dtos';
import { ChatMessageRole, SERVICE_TCP_PATTERNS, ServiceName } from '@semcache/shared-types';
import { firstValueFrom, toArray } from 'rxjs';
import { AppModule } from '../src/app.module';

describe('LLM Service (TCP e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
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

    ({ app, client } = await createTcpMicroserviceTestClient(moduleFixture));
  });

  afterEach(async () => {
    await client.close();
    await app.close();
    process.env = { ...originalEnv };
  });

  it('app.health returns ServiceName.LLM_SERVICE health status', async () => {
    const res = await firstValueFrom(client.send(SERVICE_TCP_PATTERNS.APP_HEALTH, {}));
    expect(res).toEqual({
      service: ServiceName.LLM_SERVICE,
      status: 'ok',
      timestamp: expect.any(String),
    });
  });

  it('llm.chat returns completion for free OpenRouter model', async () => {
    const res = await firstValueFrom(
      client.send(SERVICE_TCP_PATTERNS.LLM_CHAT, {
        model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        messages: [
          { role: ChatMessageRole.SYSTEM, content: 'You are a helpful support assistant.' },
          { role: ChatMessageRole.USER, content: 'How do I reset my password?' },
        ],
      }),
    );

    expect(res).toEqual({
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

  async function expectPaidModelRejected(pattern: string, stream: boolean): Promise<void> {
    let caughtError: unknown;
    try {
      const obs = client.send(pattern, {
        model: 'openai/gpt-4o',
        messages: [{ role: ChatMessageRole.USER, content: 'Hi' }],
      });
      await firstValueFrom(stream ? obs.pipe(toArray()) : obs);
    } catch (error) {
      caughtError = error;
    }

    const rpcError = extractRpcErrorPayload(caughtError);
    expect(rpcError?.statusCode).toBe(400);
    expect(JSON.stringify(rpcError)).toContain('Only free OpenRouter models');
  }

  it('llm.chat rejects paid models with 400 Bad Request RPC error', async () => {
    await expectPaidModelRejected(SERVICE_TCP_PATTERNS.LLM_CHAT, false);
  });

  it('llm.chat.stream emits delta chunks and final done event over TCP', async () => {
    const events = await firstValueFrom(
      client
        .send<LlmChatStreamEventDto>(SERVICE_TCP_PATTERNS.LLM_CHAT_STREAM, {
          model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
          messages: [{ role: ChatMessageRole.USER, content: 'Stream test' }],
        })
        .pipe(toArray()),
    );

    const deltas = events.filter((event) => event.type === 'delta');
    const done = events.find((event) => event.type === 'done');

    expect(deltas.length).toBeGreaterThan(0);
    expect(deltas.map((event) => event.delta).join('')).toBe('Mocked free assistant response');
    expect(done).toEqual({
      type: 'done',
      completion: {
        content: 'Mocked free assistant response',
        model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        latencyMs: expect.any(Number),
        usage: {
          promptTokens: 15,
          completionTokens: 7,
          totalTokens: 22,
        },
      },
    });
  });

  it('llm.chat.stream rejects paid models with 400 Bad Request RPC error', async () => {
    await expectPaidModelRejected(SERVICE_TCP_PATTERNS.LLM_CHAT_STREAM, true);
  });
});
