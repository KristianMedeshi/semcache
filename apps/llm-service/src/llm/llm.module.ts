import { createOpenAICompatible, type OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import { Module } from '@nestjs/common';
import { AiModule } from '@nestjs/ai';
import { FakeModel } from '@nestjs/ai/testing';
import { ConfigService } from '@semcache/shared-config';
import type { LlmEnv } from '../config/llm.env';
import { LlmController } from './llm.controller';
import { LlmService, OPENROUTER_PROVIDER } from './llm.service';
import { LlmPolicy } from './policies/llm.policy';

export function createOpenRouterProvider(
  config: ConfigService<LlmEnv, true>,
): OpenAICompatibleProvider {
  return createOpenAICompatible({
    name: 'openrouter',
    baseURL: config.getOrThrow('OPENROUTER_BASE_URL'),
    apiKey: config.get('OPENROUTER_API_KEY') || 'unconfigured-api-key',
    headers: {
      'X-Title': 'SemCache',
    },
  });
}

@Module({
  imports: [
    AiModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<LlmEnv, true>) => {
        const openRouterApiKey = config.get('OPENROUTER_API_KEY') ?? '';
        const hasApiKey =
          openRouterApiKey.length > 0 &&
          openRouterApiKey !== 'replace_with_your_openrouter_api_key';
        const defaultModelName = config.getOrThrow('OPENROUTER_DEFAULT_MODEL');

        const defaultModel =
          config.getOrThrow('NODE_ENV') === 'test' && !hasApiKey
            ? new FakeModel(() => 'Simulated free OpenRouter assistant response', {
                provider: 'openrouter',
                modelId: defaultModelName,
              })
            : createOpenRouterProvider(config).chatModel(defaultModelName);

        return {
          models: {
            default: defaultModel,
          },
          defaults: {
            timeout: config.getOrThrow('OPENROUTER_TIMEOUT_MS'),
            retry: { attempts: 2 },
          },
        };
      },
    }),
  ],
  controllers: [LlmController],
  providers: [
    {
      provide: OPENROUTER_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<LlmEnv, true>) => createOpenRouterProvider(config),
    },
    LlmService,
    LlmPolicy,
  ],
  exports: [LlmService, LlmPolicy],
})
export class LlmModule {}
