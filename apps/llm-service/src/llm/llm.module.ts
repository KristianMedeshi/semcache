import { createOpenAICompatible, type OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import { Module } from '@nestjs/common';
import { AiModule } from '@nestjs/ai';
import { FakeModel } from '@nestjs/ai/testing';
import { LlmConfigService } from '../config/llm-config.service';
import { LlmController } from './llm.controller';
import { LlmService, OPENROUTER_PROVIDER } from './llm.service';

export function createOpenRouterProvider(config: LlmConfigService): OpenAICompatibleProvider {
  return createOpenAICompatible({
    name: 'openrouter',
    baseURL: config.openRouterBaseUrl,
    apiKey: config.openRouterApiKey || 'unconfigured-api-key',
    headers: {
      'X-Title': 'SemCache',
    },
  });
}

@Module({
  imports: [
    AiModule.forRootAsync({
      inject: [LlmConfigService],
      useFactory: (config: LlmConfigService) => {
        const hasApiKey =
          config.openRouterApiKey.length > 0 &&
          config.openRouterApiKey !== 'replace_with_your_openrouter_api_key';

        const defaultModel =
          config.nodeEnv === 'test' && !hasApiKey
            ? new FakeModel(() => 'Simulated free OpenRouter assistant response', {
                provider: 'openrouter',
                modelId: config.defaultModel,
              })
            : createOpenRouterProvider(config).chatModel(config.defaultModel);

        return {
          models: {
            default: defaultModel,
          },
          defaults: {
            timeout: config.requestTimeoutMs,
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
      inject: [LlmConfigService],
      useFactory: (config: LlmConfigService) => createOpenRouterProvider(config),
    },
    LlmService,
  ],
  exports: [LlmService],
})
export class LlmModule {}
