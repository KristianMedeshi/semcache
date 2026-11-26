import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiModule, AiService } from '@nestjs/ai';
import { FakeModel, overrideModels, providerError } from '@nestjs/ai/testing';
import { Test, type TestingModule } from '@nestjs/testing';
import { SharedConfigModule, createValidatedConfigService } from '@semcache/shared-config';
import { ChatMessageRole } from '@semcache/shared-types';
import { firstValueFrom, toArray } from 'rxjs';
import { llmEnvSchema } from '../config/llm.env';
import { LlmModule } from './llm.module';
import { LM_STUDIO_PROVIDER, LlmService, OPENROUTER_PROVIDER } from './llm.service';

describe('LlmService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  async function createLlmTestService(
    fake?: FakeModel,
  ): Promise<{ service: LlmService; moduleRef: TestingModule }> {
    process.env.NODE_ENV = 'test';
    delete process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_DEFAULT_MODEL ??= 'openrouter/free';

    const builder = Test.createTestingModule({
      imports: [
        SharedConfigModule.forRoot({ schema: llmEnvSchema, ignoreEnvFile: true }),
        LlmModule,
      ],
    });
    const moduleRef = await (fake ? overrideModels(builder, { default: fake }) : builder).compile();
    return { service: moduleRef.get(LlmService), moduleRef };
  }

  it('generates completion using default free model and FakeModel override', async () => {
    process.env.OPENROUTER_DEFAULT_MODEL = 'openrouter/free';

    const fake = new FakeModel([
      {
        text: 'Hello! How can I help you today?',
        usage: { inputTokens: 12, outputTokens: 8 },
      },
    ]);

    const { service, moduleRef } = await createLlmTestService(fake);
    const result = await service.generateChatCompletion({
      messages: [{ role: ChatMessageRole.USER, content: 'Hi' }],
    });

    expect(result).toEqual({
      content: 'Hello! How can I help you today?',
      model: 'openrouter/free',
      latencyMs: expect.any(Number),
      usage: {
        promptTokens: 12,
        completionTokens: 8,
        totalTokens: 20,
      },
    });
    expect(fake.lastCall?.lastUserMessage).toBe('Hi');
    await moduleRef.close();
  });

  it('extracts system messages into instructions instead of passing them in messages', async () => {
    process.env.OPENROUTER_DEFAULT_MODEL = 'openrouter/free';

    const fake = new FakeModel(['Here is how to reset your password.']);
    const { service, moduleRef } = await createLlmTestService(fake);
    const result = await service.generateChatCompletion({
      messages: [
        { role: ChatMessageRole.SYSTEM, content: 'You are a helpful support assistant.' },
        { role: ChatMessageRole.USER, content: 'How do I reset my password?' },
      ],
    });

    expect(result.content).toBe('Here is how to reset your password.');
    expect(fake.lastCall?.instructions).toBe('You are a helpful support assistant.');
    expect(fake.lastCall?.lastUserMessage).toBe('How do I reset my password?');
    await moduleRef.close();
  });

  it('rejects requests containing only system messages', async () => {
    const { service, moduleRef } = await createLlmTestService();

    await expect(
      service.generateChatCompletion({
        messages: [{ role: ChatMessageRole.SYSTEM, content: 'System only' }],
      }),
    ).rejects.toThrow(BadRequestException);

    await moduleRef.close();
  });

  it('rejects non-free OpenRouter models at request time', async () => {
    const { service, moduleRef } = await createLlmTestService();

    await expect(
      service.generateChatCompletion({
        model: 'openai/gpt-4o',
        messages: [{ role: ChatMessageRole.USER, content: 'Hi' }],
      }),
    ).rejects.toThrow(BadRequestException);

    await moduleRef.close();
  });

  it('rejects non-free OPENROUTER_DEFAULT_MODEL at startup', () => {
    process.env.OPENROUTER_DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet';
    expect(() => createValidatedConfigService(llmEnvSchema, { loadEnvFiles: false })).toThrow(
      /Only free OpenRouter models/,
    );
  });

  it('throws ServiceUnavailableException outside test mode when OPENROUTER_API_KEY is missing', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.OPENROUTER_API_KEY;

    const moduleRef = await Test.createTestingModule({
      imports: [
        SharedConfigModule.forRoot({ schema: llmEnvSchema, ignoreEnvFile: true }),
        AiModule.forRoot({
          models: { default: new FakeModel(['unused']) },
        }),
      ],
      providers: [
        {
          provide: OPENROUTER_PROVIDER,
          useValue: { chatModel: jest.fn() },
        },
        LlmService,
      ],
    }).compile();

    const service = moduleRef.get(LlmService);
    await expect(
      service.generateChatCompletion({
        messages: [{ role: ChatMessageRole.USER, content: 'Hi' }],
      }),
    ).rejects.toThrow(ServiceUnavailableException);

    await moduleRef.close();
  });

  it('wraps upstream provider errors into BadGatewayException', async () => {
    const fake = new FakeModel([
      providerError(500, { message: 'OpenRouter down' }),
      providerError(500, { message: 'OpenRouter down' }),
    ]);
    const { service, moduleRef } = await createLlmTestService(fake);
    await expect(
      service.generateChatCompletion({
        messages: [{ role: ChatMessageRole.USER, content: 'Hi' }],
      }),
    ).rejects.toThrow(BadGatewayException);

    await moduleRef.close();
  });

  it('passes selected custom free model directly without falling back to openrouter/free', async () => {
    process.env.NODE_ENV = 'test';
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';
    process.env.OPENROUTER_DEFAULT_MODEL = 'openrouter/free';

    const fakeCustomModel = new FakeModel(['unused']);
    const generateTextMock = jest.fn().mockResolvedValue({
      text: 'Direct custom model response',
      finishReason: 'stop',
      steps: [],
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        cachedInputTokens: 0,
        reasoningTokens: 0,
      },
      toolCalls: [],
      toolResults: [],
      responseMessages: [],
      model: {
        provider: 'openrouter.chat',
        modelId: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [SharedConfigModule.forRoot({ schema: llmEnvSchema, ignoreEnvFile: true })],
      providers: [
        {
          provide: AiService,
          useValue: { generateText: generateTextMock },
        },
        {
          provide: OPENROUTER_PROVIDER,
          useValue: { chatModel: jest.fn().mockReturnValue(fakeCustomModel) },
        },
        LlmService,
      ],
    }).compile();

    const service = moduleRef.get(LlmService);
    const result = await service.generateChatCompletion({
      model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      messages: [{ role: ChatMessageRole.USER, content: 'Hello' }],
    });

    expect(generateTextMock).toHaveBeenCalledWith({
      model: fakeCustomModel,
      messages: [{ role: 'user', content: 'Hello' }],
    });
    expect(result.model).toBe('nvidia/nemotron-3-ultra-550b-a55b:free');
    await moduleRef.close();
  });

  it('defaults requestTimeoutMs to 180000ms and allows OPENROUTER_TIMEOUT_MS override', () => {
    delete process.env.OPENROUTER_TIMEOUT_MS;
    const defaultConfig = createValidatedConfigService(llmEnvSchema, {
      loadEnvFiles: false,
    });
    expect(defaultConfig.getOrThrow('OPENROUTER_TIMEOUT_MS')).toBe(180_000);

    process.env.OPENROUTER_TIMEOUT_MS = '240000';
    const overrideConfig = createValidatedConfigService(llmEnvSchema, {
      loadEnvFiles: false,
    });
    expect(overrideConfig.getOrThrow('OPENROUTER_TIMEOUT_MS')).toBe(240_000);

    process.env.OPENROUTER_TIMEOUT_MS = '0';
    expect(() => createValidatedConfigService(llmEnvSchema, { loadEnvFiles: false })).toThrow(
      /OPENROUTER_TIMEOUT_MS must be a positive integer/,
    );
  });

  it('streams delta chunks and a final done event via streamChatCompletion', async () => {
    process.env.OPENROUTER_DEFAULT_MODEL = 'openrouter/free';

    const fake = new FakeModel([
      {
        text: 'Hello from stream!',
        usage: { inputTokens: 11, outputTokens: 4 },
      },
    ]);

    const { service, moduleRef } = await createLlmTestService(fake);
    const events = await firstValueFrom(
      service
        .streamChatCompletion({
          messages: [{ role: ChatMessageRole.USER, content: 'Stream please' }],
        })
        .pipe(toArray()),
    );

    const deltas = events.filter((event) => event.type === 'delta');
    const done = events.find((event) => event.type === 'done');

    expect(deltas.length).toBeGreaterThan(0);
    expect(deltas.map((event) => event.delta).join('')).toBe('Hello from stream!');
    expect(done).toEqual({
      type: 'done',
      completion: {
        content: 'Hello from stream!',
        model: 'openrouter/free',
        latencyMs: expect.any(Number),
        usage: {
          promptTokens: 11,
          completionTokens: 4,
          totalTokens: 15,
        },
      },
    });
    expect(fake.lastCall?.stream).toBe(true);
    await moduleRef.close();
  });

  it('emits BadRequestException on streamChatCompletion for non-free models', async () => {
    const { service, moduleRef } = await createLlmTestService();

    await expect(
      firstValueFrom(
        service
          .streamChatCompletion({
            model: 'openai/gpt-4o',
            messages: [{ role: ChatMessageRole.USER, content: 'Hi' }],
          })
          .pipe(toArray()),
      ),
    ).rejects.toThrow(BadRequestException);

    await moduleRef.close();
  });

  it('wraps upstream provider stream errors into BadGatewayException', async () => {
    const fake = new FakeModel([
      providerError(500, { message: 'Stream down' }),
      providerError(500, { message: 'Stream down' }),
    ]);
    const { service, moduleRef } = await createLlmTestService(fake);
    await expect(
      firstValueFrom(
        service
          .streamChatCompletion({
            messages: [{ role: ChatMessageRole.USER, content: 'Hi' }],
          })
          .pipe(toArray()),
      ),
    ).rejects.toThrow(BadGatewayException);

    await moduleRef.close();
  });

  async function runLmStudioChatTest(options: {
    providerEnv: string;
    model: string;
    replyText: string;
    prompt: string;
  }) {
    process.env.LLM_PROVIDER = options.providerEnv;
    process.env.LM_STUDIO_BASE_URL = 'http://localhost:1234/v1';
    process.env.LM_STUDIO_DEFAULT_MODEL = 'support-llm';

    const fakeLmModel = new FakeModel(['unused']);
    const chatModelMock = jest.fn().mockReturnValue(fakeLmModel);
    const generateTextMock = jest.fn().mockResolvedValue({
      text: options.replyText,
      finishReason: 'stop',
      steps: [],
      usage: { inputTokens: 8, outputTokens: 5, totalTokens: 13 },
      toolCalls: [],
      toolResults: [],
      responseMessages: [],
      model: { provider: 'lmstudio.chat', modelId: options.model },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [SharedConfigModule.forRoot({ schema: llmEnvSchema, ignoreEnvFile: true })],
      providers: [
        { provide: AiService, useValue: { generateText: generateTextMock } },
        { provide: OPENROUTER_PROVIDER, useValue: { chatModel: jest.fn() } },
        { provide: LM_STUDIO_PROVIDER, useValue: { chatModel: chatModelMock } },
        LlmService,
      ],
    }).compile();

    const service = moduleRef.get(LlmService);
    const result = await service.generateChatCompletion({
      model: options.model,
      messages: [{ role: ChatMessageRole.USER, content: options.prompt }],
    });
    await moduleRef.close();

    return { result, fakeLmModel, chatModelMock, generateTextMock };
  }

  it('routes requests to LM Studio without OpenRouter API key when LLM_PROVIDER=lmstudio', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.OPENROUTER_API_KEY;

    const { result, fakeLmModel, generateTextMock } = await runLmStudioChatTest({
      providerEnv: 'lmstudio',
      model: 'qwen/qwen3-1.7b',
      replyText: 'Local LM Studio reply',
      prompt: 'Check EU roaming',
    });

    expect(result.content).toBe('Local LM Studio reply');
    expect(result.model).toBe('qwen/qwen3-1.7b');
    expect(generateTextMock).toHaveBeenCalledWith({
      model: fakeLmModel,
      messages: [{ role: 'user', content: 'Check EU roaming' }],
    });
  });

  it('routes explicit local model requests to LM Studio even when LLM_PROVIDER=openrouter', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.OPENROUTER_API_KEY;

    const { result, chatModelMock } = await runLmStudioChatTest({
      providerEnv: 'openrouter',
      model: 'support-llm',
      replyText: 'Routed local model reply',
      prompt: 'APN settings?',
    });

    expect(chatModelMock).toHaveBeenCalledWith('support-llm');
    expect(result.content).toBe('Routed local model reply');
  });
});
