import type { OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import type { AiCallOptions, AiTextResult } from '@nestjs/ai';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@semcache/shared-config';
import {
  FREE_OPENROUTER_MODEL_MESSAGE,
  type LlmChatCompletionRequestDto,
  type LlmChatCompletionResponseDto,
} from '@semcache/shared-dtos';
import { ChatMessageRole } from '@semcache/shared-types';
import {
  type LlmEnv,
  isFreeOpenRouterModel,
  isLocalLlmModel,
  normalizeLocalModelId,
} from '../config/llm.env';

const PLACEHOLDER_API_KEY = 'replace_with_your_openrouter_api_key';

export interface PreparedChatCall {
  targetModel: string;
  callOptions: AiCallOptions;
}

function resolveModelOption(
  dtoModel: string | undefined,
  config: ConfigService<LlmEnv, true>,
  openRouterProvider: OpenAICompatibleProvider,
  lmStudioProvider?: OpenAICompatibleProvider | null,
): {
  targetModel: string;
  customModelOption?: { model: ReturnType<OpenAICompatibleProvider['chatModel']> };
} {
  const provider = config.get('LLM_PROVIDER') ?? 'openrouter';
  const lmStudioDefaultModel = config.get('LM_STUDIO_DEFAULT_MODEL') ?? 'support-llm';
  const allowedLocalModels = [
    ...(config.get('LM_STUDIO_ALLOWED_MODELS') ?? ['support-llm', 'qwen/qwen3-1.7b']),
    lmStudioDefaultModel,
  ];
  const requestedModel = dtoModel?.trim();

  const useLocalProvider =
    provider === 'lmstudio' ||
    (requestedModel !== undefined && isLocalLlmModel(requestedModel, allowedLocalModels));

  if (useLocalProvider) {
    const targetModel = normalizeLocalModelId(requestedModel || lmStudioDefaultModel);
    if (provider !== 'lmstudio' || targetModel !== lmStudioDefaultModel) {
      if (!lmStudioProvider) {
        throw new ServiceUnavailableException(
          'LM_STUDIO_BASE_URL is not configured for local models',
        );
      }
      return { targetModel, customModelOption: { model: lmStudioProvider.chatModel(targetModel) } };
    }
    return { targetModel };
  }

  const defaultModel = config.getOrThrow('OPENROUTER_DEFAULT_MODEL');
  const targetModel = requestedModel || defaultModel;

  if (!isFreeOpenRouterModel(targetModel)) {
    throw new BadRequestException(FREE_OPENROUTER_MODEL_MESSAGE);
  }

  const openRouterApiKey = config.get('OPENROUTER_API_KEY') ?? '';
  const hasApiKey = openRouterApiKey.length > 0 && openRouterApiKey !== PLACEHOLDER_API_KEY;

  if (config.getOrThrow('NODE_ENV') !== 'test' && !hasApiKey) {
    throw new ServiceUnavailableException('OPENROUTER_API_KEY is not configured');
  }

  if (hasApiKey && targetModel !== defaultModel) {
    return { targetModel, customModelOption: { model: openRouterProvider.chatModel(targetModel) } };
  }
  return { targetModel };
}

export function prepareLlmChatCall(
  dto: LlmChatCompletionRequestDto,
  config: ConfigService<LlmEnv, true>,
  openRouterProvider: OpenAICompatibleProvider,
  lmStudioProvider?: OpenAICompatibleProvider | null,
): PreparedChatCall {
  const { targetModel, customModelOption } = resolveModelOption(
    dto.model,
    config,
    openRouterProvider,
    lmStudioProvider,
  );

  const systemParts = dto.messages
    .filter((message) => message.role === ChatMessageRole.SYSTEM)
    .map((message) => message.content.trim())
    .filter((content) => content.length > 0);
  const instructions = systemParts.length > 0 ? systemParts.join('\n\n') : undefined;

  const messages = dto.messages
    .filter((message) => message.role !== ChatMessageRole.SYSTEM)
    .map((message) => ({
      role: message.role === ChatMessageRole.USER ? ('user' as const) : ('assistant' as const),
      content: message.content,
    }));

  if (messages.length === 0) {
    throw new BadRequestException('At least one non-system message is required');
  }

  const callOptions: AiCallOptions = {
    ...(customModelOption ?? {}),
    ...(instructions !== undefined ? { instructions } : {}),
    messages,
    ...(dto.temperature !== undefined ? { temperature: dto.temperature } : {}),
    ...(dto.maxTokens !== undefined ? { maxOutputTokens: dto.maxTokens } : {}),
  };

  return { targetModel, callOptions };
}

export function buildLlmCompletionResponse(
  result: AiTextResult,
  targetModel: string,
  startedAt: number,
): LlmChatCompletionResponseDto {
  const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
  const promptTokens = result.usage.inputTokens ?? 0;
  const completionTokens = result.usage.outputTokens ?? 0;
  const totalTokens = result.usage.totalTokens ?? promptTokens + completionTokens;
  const resolvedModel =
    result.model?.provider !== 'fake' && result.model?.modelId ? result.model.modelId : targetModel;

  return {
    content: result.text,
    model: resolvedModel,
    latencyMs,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens,
    },
  };
}

export function formatProviderErrorLog(error: unknown, targetModel: string): string {
  const causeObj =
    error instanceof Error && error.cause && typeof error.cause === 'object'
      ? (error.cause as { responseBody?: unknown; message?: unknown })
      : undefined;

  return JSON.stringify({
    event: 'llm.chat.provider_error',
    model: targetModel,
    error: error instanceof Error ? error.message : 'Unknown OpenRouter error',
    ...(causeObj?.responseBody !== undefined
      ? { responseBody: causeObj.responseBody }
      : causeObj?.message !== undefined
        ? { cause: causeObj.message }
        : {}),
  });
}
