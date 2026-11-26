import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@semcache/shared-config';
import {
  EMBEDDING_VALIDATION_LIMITS,
  type GenerateEmbeddingsRequestDto,
  type GenerateEmbeddingsResponseDto,
} from '@semcache/shared-dtos';
import type { EmbeddingEnv } from '../config/embedding.env';
import {
  DEFAULT_LOCAL_EMBEDDING_MODEL,
  computeTransformersEmbeddings,
  estimateTokenCount,
  resolveLocalEmbeddingModelId,
} from './transformers-embedding.util';

@Injectable()
export class EmbeddingService {
  constructor(private readonly config: ConfigService<EmbeddingEnv, true>) {}

  async generateEmbeddings(
    dto: GenerateEmbeddingsRequestDto,
  ): Promise<GenerateEmbeddingsResponseDto> {
    if (!Array.isArray(dto.texts) || dto.texts.length === 0) {
      throw new BadRequestException('At least one text is required for embedding generation');
    }

    const configuredModel = this.config.get('EMBEDDING_MODEL') ?? DEFAULT_LOCAL_EMBEDDING_MODEL;
    const requestedModel = dto.model?.trim() || configuredModel;
    const startedAt = performance.now();
    const targetDimensions = EMBEDDING_VALIDATION_LIMITS.DIMENSIONS;

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
}
