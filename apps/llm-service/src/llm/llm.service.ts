import type { OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import { type AiCallOptions, AiService, type AiTextResult } from '@nestjs/ai';
import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isFreeOpenRouterModel } from '../config/llm.env';
import {
  FREE_OPENROUTER_MODEL_MESSAGE,
  type LlmChatCompletionRequestDto,
  type LlmChatCompletionResponseDto,
  type LlmChatStreamEventDto,
} from '@semcache/shared-dtos';
import { ChatMessageRole } from '@semcache/shared-types';
import { Observable } from 'rxjs';
import { LlmConfigService } from '../config/llm-config.service';

export const OPENROUTER_PROVIDER = Symbol('OPENROUTER_PROVIDER');

const PLACEHOLDER_API_KEY = 'replace_with_your_openrouter_api_key';

interface PreparedChatCall {
  targetModel: string;
  callOptions: AiCallOptions;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly config: LlmConfigService,
    @Inject(OPENROUTER_PROVIDER) private readonly openRouterProvider: OpenAICompatibleProvider,
  ) {}

  async generateChatCompletion(
    dto: LlmChatCompletionRequestDto,
  ): Promise<LlmChatCompletionResponseDto> {
    const { targetModel, callOptions } = this.prepareChatCall(dto);
    const startedAt = performance.now();

    try {
      const result = await this.aiService.generateText(callOptions);
      return this.buildCompletionResponse(result, targetModel, startedAt);
    } catch (error) {
      throw this.toProviderException(error, targetModel);
    }
  }

  streamChatCompletion(dto: LlmChatCompletionRequestDto): Observable<LlmChatStreamEventDto> {
    return new Observable<LlmChatStreamEventDto>((subscriber) => {
      let aborted = false;
      let abortStream: (() => void) | undefined;

      const run = async () => {
        const { targetModel, callOptions } = this.prepareChatCall(dto);
        const startedAt = performance.now();
        const stream = this.aiService.streamText(callOptions);
        abortStream = () => stream.abort();

        if (aborted) {
          stream.abort();
          return;
        }

        try {
          for await (const delta of stream.textStream) {
            if (aborted) {
              return;
            }
            if (delta.length > 0) {
              subscriber.next({ type: 'delta', delta });
            }
          }

          const result = await stream.result;
          if (aborted) {
            return;
          }

          subscriber.next({
            type: 'done',
            completion: this.buildCompletionResponse(result, targetModel, startedAt),
          });
          subscriber.complete();
        } catch (error) {
          if (!aborted) {
            subscriber.error(this.toProviderException(error, targetModel));
          }
        }
      };

      void run().catch((error: unknown) => {
        if (!aborted) {
          subscriber.error(error);
        }
      });

      return () => {
        aborted = true;
        abortStream?.();
      };
    });
  }

  private prepareChatCall(dto: LlmChatCompletionRequestDto): PreparedChatCall {
    const targetModel = dto.model?.trim() || this.config.defaultModel;

    if (!isFreeOpenRouterModel(targetModel)) {
      throw new BadRequestException(FREE_OPENROUTER_MODEL_MESSAGE);
    }

    const hasApiKey =
      this.config.openRouterApiKey.length > 0 &&
      this.config.openRouterApiKey !== PLACEHOLDER_API_KEY;

    if (this.config.nodeEnv !== 'test' && !hasApiKey) {
      throw new ServiceUnavailableException('OPENROUTER_API_KEY is not configured');
    }

    const useCustomModel = hasApiKey && targetModel !== this.config.defaultModel;
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
      ...(useCustomModel ? { model: this.openRouterProvider.chatModel(targetModel) } : {}),
      ...(instructions !== undefined ? { instructions } : {}),
      messages,
      ...(dto.temperature !== undefined ? { temperature: dto.temperature } : {}),
      ...(dto.maxTokens !== undefined ? { maxOutputTokens: dto.maxTokens } : {}),
    };

    return { targetModel, callOptions };
  }

  private buildCompletionResponse(
    result: AiTextResult,
    targetModel: string,
    startedAt: number,
  ): LlmChatCompletionResponseDto {
    const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
    const promptTokens = result.usage.inputTokens ?? 0;
    const completionTokens = result.usage.outputTokens ?? 0;
    const totalTokens = result.usage.totalTokens ?? promptTokens + completionTokens;
    const resolvedModel =
      result.model?.provider !== 'fake' && result.model?.modelId
        ? result.model.modelId
        : targetModel;

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

  private toProviderException(error: unknown, targetModel: string): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    this.logger.error(
      JSON.stringify({
        event: 'llm.chat.provider_error',
        model: targetModel,
        error: error instanceof Error ? error.message : 'Unknown OpenRouter error',
      }),
    );
    return new BadGatewayException('Failed to generate completion from OpenRouter');
  }
}
