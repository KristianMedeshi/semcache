import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import {
  type ConfigService,
  extractRpcErrorPayload,
  formatRpcErrorMessage,
} from '@semcache/shared-config';
import type {
  DialogMessageResponseDto,
  DialogMessageStreamEventDto,
  DialogResponseDto,
  KnowledgeBaseTcpRequestDto,
  LlmGenerateEmbeddingsRequestDto,
  LlmGenerateEmbeddingsResponseDto,
  RetrieveKnowledgeContextRequestDto,
  RetrieveKnowledgeContextResponseDto,
  SemanticCacheEntryResponseDto,
  SemanticCacheLookupRequestDto,
  SemanticCacheLookupResponseDto,
  SemanticCacheStoreRequestDto,
  SemanticCacheTcpRequestDto,
  SemanticCacheTurnMetadataDto,
} from '@semcache/shared-dtos';
import {
  CacheHitStatus,
  CacheMode,
  ChatMessageRole,
  SERVICE_TCP_PATTERNS,
} from '@semcache/shared-types';
import { type Subscriber, firstValueFrom, timeout } from 'rxjs';
import type { DialogEnv } from '../config/dialog.env';
import {
  type DialogTurnStateType,
  buildSystemPromptWithKnowledge,
  classifyQueryCategory,
} from './dialog-turn.helpers';

const KB_RETRIEVAL_TIMEOUT_MS = 5_000;
const CACHE_EMBEDDING_TIMEOUT_MS = 10_000;
const CACHE_LOOKUP_TIMEOUT_MS = 5_000;
const CACHE_STORE_TIMEOUT_MS = 5_000;

export function translateLlmRpcError(
  error: unknown,
  dialogId: string,
  logger: Logger,
): HttpException {
  const rpcError = extractRpcErrorPayload(error);
  if (rpcError) {
    const message = formatRpcErrorMessage(rpcError, 'LLM service error');
    if (rpcError.statusCode === 400) {
      return new BadRequestException(message);
    }
    if (rpcError.statusCode === 503) {
      return new ServiceUnavailableException(message);
    }
    return new BadGatewayException(message);
  }

  logger.error(
    JSON.stringify({
      event: 'dialog.llm_service.network_error',
      dialogId,
      error: error instanceof Error ? error.message : 'Unknown TCP error',
    }),
  );
  return new BadGatewayException('LLM service unavailable');
}

export async function lookupDialogSemanticCache(
  state: DialogTurnStateType,
  deps: {
    llmClient: ClientProxy;
    semanticCacheClient?: ClientProxy;
    logger: Logger;
  },
): Promise<Partial<DialogTurnStateType>> {
  if (!deps.semanticCacheClient) {
    return { cacheLookup: null, cacheHit: false, queryEmbedding: null };
  }

  const category = state.queryCategory ?? classifyQueryCategory(state.userContent);
  if (state.cacheMode === CacheMode.DISABLED) {
    return {
      queryEmbedding: null,
      cacheHit: false,
      cacheLookup: {
        status: CacheHitStatus.BYPASS,
        mode: CacheMode.DISABLED,
        evaluation: {
          category,
          cosineSimilarity: 0,
          adaptiveThreshold: 0,
          cacheStatus: CacheHitStatus.BYPASS,
          mode: CacheMode.DISABLED,
        },
      },
    };
  }

  const startedAt = performance.now();
  try {
    const embeddingResponse = await firstValueFrom(
      deps.llmClient
        .send<LlmGenerateEmbeddingsResponseDto, LlmGenerateEmbeddingsRequestDto>(
          SERVICE_TCP_PATTERNS.LLM_EMBEDDINGS,
          { texts: [state.userContent] },
        )
        .pipe(timeout(CACHE_EMBEDDING_TIMEOUT_MS)),
    );
    const embedding = embeddingResponse.embeddings[0];
    if (!embedding) {
      return { cacheLookup: null, cacheHit: false, queryEmbedding: null };
    }

    const lookup = await firstValueFrom(
      deps.semanticCacheClient
        .send<
          SemanticCacheLookupResponseDto,
          SemanticCacheTcpRequestDto<SemanticCacheLookupRequestDto>
        >(SERVICE_TCP_PATTERNS.CACHE_LOOKUP, {
          body: {
            query: state.userContent,
            embedding,
            category,
            sessionId: state.dialog.id,
            ...(state.cacheMode !== undefined ? { mode: state.cacheMode } : {}),
            ...(state.fixedThresholdOverride !== undefined
              ? { fixedThresholdOverride: state.fixedThresholdOverride }
              : {}),
          },
        })
        .pipe(timeout(CACHE_LOOKUP_TIMEOUT_MS)),
    );

    if (lookup.status === CacheHitStatus.HIT && lookup.cachedResponse) {
      return {
        queryEmbedding: embedding,
        cacheLookup: lookup,
        cacheHit: true,
        llmCompletion: {
          content: lookup.cachedResponse,
          model: 'semantic-cache',
          latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        },
      };
    }

    return { queryEmbedding: embedding, cacheLookup: lookup, cacheHit: false };
  } catch (error) {
    deps.logger.warn(
      JSON.stringify({
        event: 'dialog.semantic_cache.lookup_fallback',
        dialogId: state.dialog.id,
        error: error instanceof Error ? error.message : 'Unknown semantic cache error',
      }),
    );
    return { cacheLookup: null, cacheHit: false, queryEmbedding: null };
  }
}

export async function storeDialogSemanticCache(
  state: DialogTurnStateType,
  deps: {
    semanticCacheClient?: ClientProxy;
    logger: Logger;
  },
): Promise<Partial<DialogTurnStateType>> {
  if (
    !deps.semanticCacheClient ||
    state.cacheHit ||
    state.cacheLookup?.status !== CacheHitStatus.MISS ||
    !state.queryEmbedding ||
    !state.llmCompletion?.content
  ) {
    return {};
  }

  const category =
    state.cacheLookup.evaluation.category ??
    state.queryCategory ??
    classifyQueryCategory(state.userContent);
  const sources = state.knowledgeContext?.sources ?? [];
  const knowledgeSourceIds = [...new Set(sources.map((s) => s.documentId))];
  const knowledgeSources = sources.map((s) => ({
    documentId: s.documentId,
    documentTitle: s.documentTitle,
    chunkId: s.chunkId,
    chunkIndex: s.chunkIndex,
  }));

  try {
    await firstValueFrom(
      deps.semanticCacheClient
        .send<
          SemanticCacheEntryResponseDto,
          SemanticCacheTcpRequestDto<SemanticCacheStoreRequestDto>
        >(SERVICE_TCP_PATTERNS.CACHE_STORE, {
          body: {
            query: state.userContent,
            response: state.llmCompletion.content,
            embedding: state.queryEmbedding,
            category,
            ...(knowledgeSourceIds.length > 0 ? { knowledgeSourceIds } : {}),
            ...(knowledgeSources.length > 0 ? { knowledgeSources } : {}),
            model: state.llmCompletion.model,
          },
        })
        .pipe(timeout(CACHE_STORE_TIMEOUT_MS)),
    );
  } catch (error) {
    deps.logger.warn(
      JSON.stringify({
        event: 'dialog.semantic_cache.store_fallback',
        dialogId: state.dialog.id,
        error: error instanceof Error ? error.message : 'Unknown semantic cache error',
      }),
    );
  }

  return {};
}

export async function retrieveDialogKnowledgeContext(
  state: DialogTurnStateType,
  deps: {
    knowledgeBaseClient?: ClientProxy;
    config?: ConfigService<DialogEnv, true>;
    logger: Logger;
  },
): Promise<Partial<DialogTurnStateType>> {
  let knowledgeContext: RetrieveKnowledgeContextResponseDto | null = null;

  if (deps.knowledgeBaseClient) {
    const topK = deps.config?.get('KB_RAG_TOP_K') ?? 4;
    const minSimilarity = deps.config?.get('KB_RAG_MIN_SIMILARITY') ?? 0.25;

    try {
      knowledgeContext = await firstValueFrom(
        deps.knowledgeBaseClient
          .send<
            RetrieveKnowledgeContextResponseDto,
            KnowledgeBaseTcpRequestDto<RetrieveKnowledgeContextRequestDto>
          >(SERVICE_TCP_PATTERNS.KB_CONTEXT_RETRIEVE, {
            body: {
              query: state.userContent,
              topK,
              minSimilarity,
            },
          })
          .pipe(timeout(KB_RETRIEVAL_TIMEOUT_MS)),
      );
    } catch (error) {
      deps.logger.warn(
        JSON.stringify({
          event: 'dialog.knowledge_base.retrieval_fallback',
          dialogId: state.dialog.id,
          error: error instanceof Error ? error.message : 'Unknown KB TCP error',
        }),
      );
    }
  }

  const systemPrompt = buildSystemPromptWithKnowledge(knowledgeContext);
  const nonSystemHistory = state.history.filter(
    (message) => message.role !== ChatMessageRole.SYSTEM,
  );

  return {
    knowledgeContext,
    history: [{ role: ChatMessageRole.SYSTEM, content: systemPrompt }, ...nonSystemHistory],
  };
}

export async function emitCompletedStreamTurn(
  persistReply: () => Promise<{
    assistantMessage?: DialogMessageResponseDto | null;
    updatedDialog?: DialogResponseDto | null;
  }>,
  userMessage: DialogMessageResponseDto,
  cacheMeta: SemanticCacheTurnMetadataDto | undefined,
  subscriber: Subscriber<DialogMessageStreamEventDto>,
  isUnsubscribed: () => boolean,
): Promise<void> {
  const { assistantMessage, updatedDialog } = await persistReply();
  if (isUnsubscribed()) {
    return;
  }
  if (!assistantMessage || !updatedDialog) {
    subscriber.error(new BadGatewayException('Dialog orchestration failed to persist reply'));
    return;
  }
  subscriber.next({
    type: 'done',
    dialog: updatedDialog,
    userMessage,
    assistantMessage,
    ...(cacheMeta ? { cache: cacheMeta } : {}),
  });
  subscriber.complete();
}
