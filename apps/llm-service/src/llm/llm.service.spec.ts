import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiModule, AiService } from '@nestjs/ai';
import { FakeModel, overrideModels, providerError } from '@nestjs/ai/testing';
import { Test } from '@nestjs/testing';
import { ChatMessageRole } from '@semcache/shared-types';
import { LlmConfigModule } from '../config/llm-config.module';
import { LlmConfigService } from '../config/llm-config.service';
import { LlmModule } from './llm.module';
import { LlmService, OPENROUTER_PROVIDER } from './llm.service';

describe('LlmService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('generates completion using default free model and FakeModel override', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_DEFAULT_MODEL = 'openrouter/free';

    const fake = new FakeModel([
      {
        text: 'Hello! How can I help you today?',
        usage: { inputTokens: 12, outputTokens: 8 },
      },
    ]);

    const moduleRef = await overrideModels(
      Test.createTestingModule({
        imports: [LlmConfigModule, LlmModule],
      }),
      { default: fake },
    ).compile();

    const service = moduleRef.get(LlmService);
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
    process.env.NODE_ENV = 'test';
    delete process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_DEFAULT_MODEL = 'openrouter/free';

    const fake = new FakeModel(['Here is how to reset your password.']);
    const moduleRef = await overrideModels(
      Test.createTestingModule({
        imports: [LlmConfigModule, LlmModule],
      }),
      { default: fake },
    ).compile();

    const service = moduleRef.get(LlmService);
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
    process.env.NODE_ENV = 'test';
    delete process.env.OPENROUTER_API_KEY;

    const moduleRef = await Test.createTestingModule({
      imports: [LlmConfigModule, LlmModule],
    }).compile();

    const service = moduleRef.get(LlmService);

    await expect(
      service.generateChatCompletion({
        messages: [{ role: ChatMessageRole.SYSTEM, content: 'System only' }],
      }),
    ).rejects.toThrow(BadRequestException);

    await moduleRef.close();
  });

  it('rejects non-free OpenRouter models at request time', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.OPENROUTER_API_KEY;

    const moduleRef = await Test.createTestingModule({
      imports: [LlmConfigModule, LlmModule],
    }).compile();

    const service = moduleRef.get(LlmService);

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
    expect(() => new LlmConfigService()).toThrow(/Only free OpenRouter models/);
  });

  it('throws ServiceUnavailableException outside test mode when OPENROUTER_API_KEY is missing', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.OPENROUTER_API_KEY;

    const moduleRef = await Test.createTestingModule({
      imports: [
        LlmConfigModule,
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
    process.env.NODE_ENV = 'test';
    delete process.env.OPENROUTER_API_KEY;

    const fake = new FakeModel([
      providerError(500, { message: 'OpenRouter down' }),
      providerError(500, { message: 'OpenRouter down' }),
    ]);
    const moduleRef = await overrideModels(
      Test.createTestingModule({
        imports: [LlmConfigModule, LlmModule],
      }),
      { default: fake },
    ).compile();

    const service = moduleRef.get(LlmService);
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
      imports: [LlmConfigModule],
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
    expect(new LlmConfigService().requestTimeoutMs).toBe(180_000);

    process.env.OPENROUTER_TIMEOUT_MS = '240000';
    expect(new LlmConfigService().requestTimeoutMs).toBe(240_000);

    process.env.OPENROUTER_TIMEOUT_MS = '0';
    expect(() => new LlmConfigService()).toThrow(
      /OPENROUTER_TIMEOUT_MS must be a positive integer/,
    );
  });
});
