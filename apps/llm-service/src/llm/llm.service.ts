import type { OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import { AiService } from '@nestjs/ai';
import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@semcache/shared-config';
import {
  KNOWLEDGE_BASE_VALIDATION_LIMITS,
  type LlmChatCompletionRequestDto,
  type LlmChatCompletionResponseDto,
  type LlmChatStreamEventDto,
  type LlmGenerateEmbeddingsRequestDto,
  type LlmGenerateEmbeddingsResponseDto,
} from '@semcache/shared-dtos';
import { Observable } from 'rxjs';
import type { LlmEnv } from '../config/llm.env';
import {
  DEFAULT_LOCAL_EMBEDDING_MODEL,
  computeTransformersEmbeddings,
  estimateTokenCount,
  resolveLocalEmbeddingModelId,
} from './deterministic-embedding.util';
import {
  buildLlmCompletionResponse,
  formatProviderErrorLog,
  prepareLlmChatCall,
} from './llm-call-builder';

export const OPENROUTER_PROVIDER = Symbol('OPENROUTER_PROVIDER');
export const LM_STUDIO_PROVIDER = Symbol('LM_STUDIO_PROVIDER');

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly config: ConfigService<LlmEnv, true>,
    @Inject(OPENROUTER_PROVIDER) private readonly openRouterProvider: OpenAICompatibleProvider,
    @Optional()
    @Inject(LM_STUDIO_PROVIDER)
    private readonly lmStudioProvider?: OpenAICompatibleProvider | null,
  ) {}

  async generateChatCompletion(
    dto: LlmChatCompletionRequestDto,
  ): Promise<LlmChatCompletionResponseDto> {
    const { targetModel, callOptions } = prepareLlmChatCall(
      dto,
      this.config,
      this.openRouterProvider,
      this.lmStudioProvider,
    );
    const startedAt = performance.now();

    try {
      const result = await this.aiService.generateText(callOptions);
      return buildLlmCompletionResponse(result, targetModel, startedAt);
    } catch (error) {
      throw this.toProviderException(error, targetModel);
    }
  }

  streamChatCompletion(dto: LlmChatCompletionRequestDto): Observable<LlmChatStreamEventDto> {
    return new Observable<LlmChatStreamEventDto>((subscriber) => {
      let aborted = false;
      let abortStream: (() => void) | undefined;

      const run = async () => {
        const { targetModel, callOptions } = prepareLlmChatCall(
          dto,
          this.config,
          this.openRouterProvider,
          this.lmStudioProvider,
        );
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
            completion: buildLlmCompletionResponse(result, targetModel, startedAt),
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

  async generateEmbeddings(
    dto: LlmGenerateEmbeddingsRequestDto,
  ): Promise<LlmGenerateEmbeddingsResponseDto> {
    if (!Array.isArray(dto.texts) || dto.texts.length === 0) {
      throw new BadRequestException('At least one text is required for embedding generation');
    }

    const configuredModel =
      this.config.get('OPENROUTER_EMBEDDING_MODEL') ?? DEFAULT_LOCAL_EMBEDDING_MODEL;
    const requestedModel = dto.model?.trim() || configuredModel;
    const startedAt = performance.now();
    const targetDimensions = KNOWLEDGE_BASE_VALIDATION_LIMITS.EMBEDDING_DIMENSIONS;

    const resolvedLocalModel = resolveLocalEmbeddingModelId(requestedModel);
    const embeddings = await computeTransformersEmbeddings(
      dto.texts,
      targetDimensions,
      resolvedLocalModel,
    );
    const totalTokens = dto.texts.reduce((sum, text) => sum + estimateTokenCount(text), 0);
    return {
      embeddings,
      model: resolvedLocalModel,
      dimensions: targetDimensions,
      latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
      usage: { totalTokens },
    };
  }

  private toProviderException(error: unknown, targetModel: string): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    this.logger.error(formatProviderErrorLog(error, targetModel));
    return new BadGatewayException('Failed to generate completion from OpenRouter');
  }
}
