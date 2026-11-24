import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ConfigService,
  extractRpcErrorPayload,
  formatRpcErrorMessage,
} from '@semcache/shared-config';
import type {
  DialogMessageResponseDto,
  DialogMessageStreamEventDto,
  DialogResponseDto,
  KnowledgeBaseTcpRequestDto,
  LlmChatCompletionRequestDto,
  LlmChatCompletionResponseDto,
  LlmChatMessageDto,
  LlmChatStreamEventDto,
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
  SendMessageResponseDto,
} from '@semcache/shared-dtos';
import {
  CacheHitStatus,
  CacheMode,
  ChatMessageRole,
  QueryCategory,
  SERVICE_TCP_PATTERNS,
} from '@semcache/shared-types';
import { Observable, type Subscription, firstValueFrom, timeout } from 'rxjs';
import type { DialogEnv } from '../config/dialog.env';
import { DEFAULT_DIALOG_TITLE, DialogsRepository } from './dialogs.repository';

export const LLM_SERVICE_CLIENT = Symbol('LLM_SERVICE_CLIENT');
export const KNOWLEDGE_BASE_SERVICE_CLIENT = Symbol('KNOWLEDGE_BASE_SERVICE_CLIENT');
export const SEMANTIC_CACHE_SERVICE_CLIENT = Symbol('SEMANTIC_CACHE_SERVICE_CLIENT');

const KB_RETRIEVAL_TIMEOUT_MS = 5_000;
const CACHE_EMBEDDING_TIMEOUT_MS = 10_000;
const CACHE_LOOKUP_TIMEOUT_MS = 5_000;
const CACHE_STORE_TIMEOUT_MS = 5_000;

const CUSTOMER_SUPPORT_SYSTEM_PROMPT = [
  'You are the official Telecom Assistant for SemCache Telecom. Help customers clearly, politely, and accurately with mobile plans and subscriptions, mobile internet and data usage, account balance and bill payments, international roaming, SIM and eSIM activation, network connectivity troubleshooting, and account management.',
  'Grounding rules (mandatory):',
  '1. Prioritize the retrieved Knowledge Base context provided below when answering customer questions, and reference the source document title naturally when applicable.',
  '2. Never invent, guess, or fabricate company-specific information (such as plan names, prices, fees, data allowances, roaming rates, activation codes, SLAs, or policies) that is not supported by the retrieved Knowledge Base context or conversation history.',
  '3. If the retrieved Knowledge Base context does not contain sufficient information to answer a company-specific question, clearly acknowledge that our knowledge base does not currently have verified details for that specific question and offer to connect the customer with a human support specialist.',
  '4. Structure responses using clean Markdown headings, bullet points, or numbered steps when helpful. Never mention internal caching, similarity scores, chunk IDs, vector metrics, or model identifiers.',
].join('\n');

export function buildSystemPromptWithKnowledge(
  knowledgeContext: RetrieveKnowledgeContextResponseDto | null,
): string {
  if (knowledgeContext?.hasRelevantContext && knowledgeContext.formattedContext.trim().length > 0) {
    return [
      CUSTOMER_SUPPORT_SYSTEM_PROMPT,
      '',
      '### Retrieved Official Knowledge Base Context',
      knowledgeContext.formattedContext,
    ].join('\n');
  }

  return [
    CUSTOMER_SUPPORT_SYSTEM_PROMPT,
    '',
    '### Retrieved Official Knowledge Base Context',
    'No relevant company documents were found in the knowledge base for this inquiry. Do not invent company-specific prices, plans, codes, or policies; explicitly acknowledge when verified company details are unavailable and offer to escalate to a human specialist.',
  ].join('\n');
}

const DialogTurnState = Annotation.Root({
  dialog: Annotation<DialogResponseDto>,
  userContent: Annotation<string>,
  requestedModel: Annotation<string | undefined>,
  parentMessageId: Annotation<string | null | undefined>,
  queryCategory: Annotation<QueryCategory | undefined>,
  cacheMode: Annotation<CacheMode | undefined>,
  fixedThresholdOverride: Annotation<number | undefined>,
  queryEmbedding: Annotation<number[] | null>,
  cacheLookup: Annotation<SemanticCacheLookupResponseDto | null>,
  cacheHit: Annotation<boolean>,
  knowledgeContext: Annotation<RetrieveKnowledgeContextResponseDto | null>,
  history: Annotation<LlmChatMessageDto[]>,
  userMessage: Annotation<DialogMessageResponseDto | null>,
  llmCompletion: Annotation<LlmChatCompletionResponseDto | null>,
  assistantMessage: Annotation<DialogMessageResponseDto | null>,
  updatedDialog: Annotation<DialogResponseDto | null>,
});

type DialogTurnStateType = typeof DialogTurnState.State;

const BILLING_KEYWORDS = [
  'bill',
  'invoice',
  'charge',
  'refund',
  'autopay',
  'payment',
  'due date',
  'рахунок',
  'списан',
  'повернен',
  'автоплат',
  'оплат',
];
const TECHNICAL_KEYWORDS = [
  'apn',
  'router',
  'wi-fi',
  'wifi',
  'volte',
  'vowifi',
  'slow',
  'outage',
  'signal',
  'sms',
  'pppoe',
  'роутер',
  'швидк',
  'збій',
  'сигнал',
  'інтернет',
];
const ACCOUNT_KEYWORDS = [
  'sim',
  'esim',
  'puk',
  'pin',
  'contract',
  'cancel',
  'terminat',
  'port',
  'suspend',
  'контракт',
  'розірв',
  'призупин',
  'перенес',
];
const PRODUCT_KEYWORDS = [
  'roam',
  'plan',
  'tariff',
  'unlimited',
  '5g',
  'bundle',
  'family',
  'роумінг',
  'тариф',
  'безліміт',
  'пакет',
];

export function classifyQueryCategory(query: string): QueryCategory {
  const text = query.toLowerCase();
  if (BILLING_KEYWORDS.some((kw) => text.includes(kw))) return QueryCategory.BILLING;
  if (TECHNICAL_KEYWORDS.some((kw) => text.includes(kw))) return QueryCategory.TECHNICAL_SUPPORT;
  if (ACCOUNT_KEYWORDS.some((kw) => text.includes(kw))) return QueryCategory.ACCOUNT_MANAGEMENT;
  if (PRODUCT_KEYWORDS.some((kw) => text.includes(kw))) return QueryCategory.PRODUCT_INQUIRY;
  return QueryCategory.GENERAL;
}

function toSemanticCacheTurnMetadata(
  lookup: SemanticCacheLookupResponseDto | null,
): SemanticCacheTurnMetadataDto | undefined {
  if (!lookup) {
    return undefined;
  }
  return {
    status: lookup.status,
    mode: lookup.mode,
    ...(lookup.entryId ? { entryId: lookup.entryId } : {}),
    ...(lookup.matchedQuery ? { matchedQuery: lookup.matchedQuery } : {}),
    cosineSimilarity: lookup.evaluation.cosineSimilarity,
    adaptiveThreshold: lookup.evaluation.adaptiveThreshold,
    ...(lookup.evaluation.localClusterDensity !== undefined
      ? { localClusterDensity: lookup.evaluation.localClusterDensity }
      : {}),
    ...(lookup.evaluation.neighborCount !== undefined
      ? { neighborCount: lookup.evaluation.neighborCount }
      : {}),
    category: lookup.evaluation.category,
    ...(lookup.knowledgeSourceIds ? { knowledgeSourceIds: lookup.knowledgeSourceIds } : {}),
  };
}

function deriveTitleFromMessage(content: string): string {
  const collapsed = content.replace(/\s+/g, ' ').trim();
  return collapsed.length > 60 ? `${collapsed.slice(0, 57)}...` : collapsed;
}

export function buildBranchHistory(
  messages: DialogMessageResponseDto[],
  leafMessageId: string,
): DialogMessageResponseDto[] {
  const byId = new Map(messages.map((message) => [message.id, message]));
  const chain: DialogMessageResponseDto[] = [];
  const visited = new Set<string>();

  let current: DialogMessageResponseDto | undefined = byId.get(leafMessageId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.push(current);
    current = current.parentMessageId ? byId.get(current.parentMessageId) : undefined;
  }

  return chain.reverse();
}

@Injectable()
export class DialogGraphService {
  private readonly logger = new Logger(DialogGraphService.name);
  private readonly compiledGraph;

  constructor(
    private readonly dialogsRepository: DialogsRepository,
    @Inject(LLM_SERVICE_CLIENT) private readonly llmClient: ClientProxy,
    @Optional()
    @Inject(KNOWLEDGE_BASE_SERVICE_CLIENT)
    private readonly knowledgeBaseClient?: ClientProxy,
    @Optional() private readonly config?: ConfigService<DialogEnv, true>,
    @Optional()
    @Inject(SEMANTIC_CACHE_SERVICE_CLIENT)
    private readonly semanticCacheClient?: ClientProxy,
  ) {
    this.compiledGraph = new StateGraph(DialogTurnState)
      .addNode('record_user_message', (state) => this.recordUserMessage(state))
      .addNode('lookup_semantic_cache', (state) => this.lookupSemanticCache(state))
      .addNode('retrieve_knowledge_context', (state) => this.retrieveKnowledgeContext(state))
      .addNode('call_llm_service', (state) => this.callLlmService(state))
      .addNode('store_semantic_cache', (state) => this.storeSemanticCache(state))
      .addNode('record_assistant_message', (state) => this.recordAssistantMessage(state))
      .addEdge(START, 'record_user_message')
      .addEdge('record_user_message', 'lookup_semantic_cache')
      .addConditionalEdges('lookup_semantic_cache', (state) =>
        state.cacheHit ? 'record_assistant_message' : 'retrieve_knowledge_context',
      )
      .addEdge('retrieve_knowledge_context', 'call_llm_service')
      .addEdge('call_llm_service', 'store_semantic_cache')
      .addEdge('store_semantic_cache', 'record_assistant_message')
      .addEdge('record_assistant_message', END)
      .compile();
  }

  private createInitialState(input: {
    dialog: DialogResponseDto;
    content: string;
    model?: string;
    parentMessageId?: string | null;
    category?: QueryCategory;
    cacheMode?: CacheMode;
    fixedThresholdOverride?: number;
  }): DialogTurnStateType {
    return {
      dialog: input.dialog,
      userContent: input.content,
      requestedModel: input.model,
      parentMessageId: input.parentMessageId,
      queryCategory: input.category,
      cacheMode: input.cacheMode,
      fixedThresholdOverride: input.fixedThresholdOverride,
      queryEmbedding: null,
      cacheLookup: null,
      cacheHit: false,
      knowledgeContext: null,
      history: [],
      userMessage: null,
      llmCompletion: null,
      assistantMessage: null,
      updatedDialog: null,
    };
  }

  async executeTurn(input: {
    dialog: DialogResponseDto;
    content: string;
    model?: string;
    parentMessageId?: string | null;
    category?: QueryCategory;
    cacheMode?: CacheMode;
    fixedThresholdOverride?: number;
  }): Promise<SendMessageResponseDto> {
    const finalState = await this.compiledGraph.invoke(this.createInitialState(input));

    if (!finalState.userMessage || !finalState.assistantMessage || !finalState.updatedDialog) {
      throw new BadGatewayException('Dialog orchestration failed to produce a complete turn');
    }

    const cache = toSemanticCacheTurnMetadata(finalState.cacheLookup);
    return {
      dialog: finalState.updatedDialog,
      userMessage: finalState.userMessage,
      assistantMessage: finalState.assistantMessage,
      ...(cache ? { cache } : {}),
    };
  }

  streamTurn(input: {
    dialog: DialogResponseDto;
    content: string;
    model?: string;
    parentMessageId?: string | null;
    category?: QueryCategory;
    cacheMode?: CacheMode;
    fixedThresholdOverride?: number;
  }): Observable<DialogMessageStreamEventDto> {
    return new Observable<DialogMessageStreamEventDto>((subscriber) => {
      let unsubscribed = false;
      let llmSubscription: Subscription | undefined;

      const start = async () => {
        const initialState = this.createInitialState(input);
        const { userMessage, history } = await this.recordUserMessage(initialState);

        if (unsubscribed || !userMessage || !history) {
          return;
        }

        subscriber.next({ type: 'user_message', userMessage });

        const lookupState = await this.lookupSemanticCache({
          ...initialState,
          userMessage,
          history,
        });
        if (unsubscribed) {
          return;
        }

        const cacheMeta = toSemanticCacheTurnMetadata(lookupState.cacheLookup ?? null);
        if (lookupState.cacheHit && lookupState.llmCompletion) {
          if (lookupState.llmCompletion.content.length > 0) {
            subscriber.next({ type: 'delta', delta: lookupState.llmCompletion.content });
          }
          const { assistantMessage, updatedDialog } = await this.recordAssistantMessage({
            ...initialState,
            ...lookupState,
            userMessage,
            history,
          });
          if (unsubscribed) {
            return;
          }
          if (!assistantMessage || !updatedDialog) {
            subscriber.error(
              new BadGatewayException('Dialog orchestration failed to persist reply'),
            );
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
          return;
        }

        const kbState = await this.retrieveKnowledgeContext({
          ...initialState,
          ...lookupState,
          userMessage,
          history,
        });
        if (unsubscribed) {
          return;
        }

        const messagesForLlm = kbState.history ?? history;
        let accumulatedContent = '';
        let finalCompletion: LlmChatCompletionResponseDto | null = null;

        llmSubscription = this.llmClient
          .send<LlmChatStreamEventDto, LlmChatCompletionRequestDto>(
            SERVICE_TCP_PATTERNS.LLM_CHAT_STREAM,
            {
              messages: messagesForLlm,
              ...(input.model ? { model: input.model } : {}),
            },
          )
          .subscribe({
            next: (event) => {
              if (unsubscribed) {
                return;
              }
              if (event.type === 'delta') {
                accumulatedContent += event.delta;
                subscriber.next({ type: 'delta', delta: event.delta });
              } else if (event.type === 'done') {
                finalCompletion = event.completion;
              }
            },
            error: (error: unknown) => {
              if (!unsubscribed) {
                subscriber.error(this.translateLlmRpcError(error, input.dialog.id));
              }
            },
            complete: () => {
              if (unsubscribed) {
                return;
              }
              if (!finalCompletion) {
                subscriber.error(new BadGatewayException('Missing LLM completion payload'));
                return;
              }

              const completionPayload: LlmChatCompletionResponseDto = {
                ...finalCompletion,
                content: finalCompletion.content || accumulatedContent,
              };
              const fullState: DialogTurnStateType = {
                ...initialState,
                ...lookupState,
                ...kbState,
                history: messagesForLlm,
                userMessage,
                llmCompletion: completionPayload,
              };

              void this.storeSemanticCache(fullState)
                .then(() => this.recordAssistantMessage(fullState))
                .then(
                  ({ assistantMessage, updatedDialog }) => {
                    if (unsubscribed) {
                      return;
                    }
                    if (!assistantMessage || !updatedDialog) {
                      subscriber.error(
                        new BadGatewayException('Dialog orchestration failed to persist reply'),
                      );
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
                  },
                  (err: unknown) => {
                    if (!unsubscribed) {
                      subscriber.error(err);
                    }
                  },
                );
            },
          });
      };

      void start().catch((error: unknown) => {
        if (!unsubscribed) {
          subscriber.error(error);
        }
      });

      return () => {
        unsubscribed = true;
        llmSubscription?.unsubscribe();
      };
    });
  }

  private async recordUserMessage(
    state: DialogTurnStateType,
  ): Promise<Partial<DialogTurnStateType>> {
    const existingMessages =
      state.parentMessageId === null
        ? []
        : await this.dialogsRepository.findMessagesByDialog(state.dialog.id);
    const resolvedParentId =
      state.parentMessageId !== undefined
        ? state.parentMessageId
        : (existingMessages.at(-1)?.id ?? null);

    const userMessage = await this.dialogsRepository.insertMessage({
      dialogId: state.dialog.id,
      parentMessageId: resolvedParentId,
      role: ChatMessageRole.USER,
      content: state.userContent,
    });

    const branchMessages =
      state.parentMessageId === null
        ? [userMessage]
        : buildBranchHistory([...existingMessages, userMessage], userMessage.id);
    const history: LlmChatMessageDto[] = [
      { role: ChatMessageRole.SYSTEM, content: CUSTOMER_SUPPORT_SYSTEM_PROMPT },
      ...branchMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    return {
      userMessage,
      history,
    };
  }

  private async lookupSemanticCache(
    state: DialogTurnStateType,
  ): Promise<Partial<DialogTurnStateType>> {
    if (!this.semanticCacheClient) {
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
        this.llmClient
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
        this.semanticCacheClient
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
      this.logger.warn(
        JSON.stringify({
          event: 'dialog.semantic_cache.lookup_fallback',
          dialogId: state.dialog.id,
          error: error instanceof Error ? error.message : 'Unknown semantic cache error',
        }),
      );
      return { cacheLookup: null, cacheHit: false, queryEmbedding: null };
    }
  }

  private async storeSemanticCache(
    state: DialogTurnStateType,
  ): Promise<Partial<DialogTurnStateType>> {
    if (
      !this.semanticCacheClient ||
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
        this.semanticCacheClient
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
      this.logger.warn(
        JSON.stringify({
          event: 'dialog.semantic_cache.store_fallback',
          dialogId: state.dialog.id,
          error: error instanceof Error ? error.message : 'Unknown semantic cache error',
        }),
      );
    }

    return {};
  }

  private async retrieveKnowledgeContext(
    state: DialogTurnStateType,
  ): Promise<Partial<DialogTurnStateType>> {
    let knowledgeContext: RetrieveKnowledgeContextResponseDto | null = null;

    if (this.knowledgeBaseClient) {
      const topK = this.config?.get('KB_RAG_TOP_K') ?? 4;
      const minSimilarity = this.config?.get('KB_RAG_MIN_SIMILARITY') ?? 0.25;

      try {
        knowledgeContext = await firstValueFrom(
          this.knowledgeBaseClient
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
        this.logger.warn(
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

  private async callLlmService(state: DialogTurnStateType): Promise<Partial<DialogTurnStateType>> {
    try {
      const llmCompletion = await firstValueFrom(
        this.llmClient.send<LlmChatCompletionResponseDto, LlmChatCompletionRequestDto>(
          SERVICE_TCP_PATTERNS.LLM_CHAT,
          {
            messages: state.history,
            ...(state.requestedModel ? { model: state.requestedModel } : {}),
          },
        ),
      );
      return { llmCompletion };
    } catch (error) {
      throw this.translateLlmRpcError(error, state.dialog.id);
    }
  }

  private translateLlmRpcError(error: unknown, dialogId: string): HttpException {
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

    this.logger.error(
      JSON.stringify({
        event: 'dialog.llm_service.network_error',
        dialogId,
        error: error instanceof Error ? error.message : 'Unknown TCP error',
      }),
    );
    return new BadGatewayException('LLM service unavailable');
  }

  private async recordAssistantMessage(
    state: DialogTurnStateType,
  ): Promise<Partial<DialogTurnStateType>> {
    if (!state.llmCompletion) {
      throw new BadGatewayException('Missing LLM completion payload');
    }

    const assistantMessage = await this.dialogsRepository.insertMessage({
      dialogId: state.dialog.id,
      parentMessageId: state.userMessage?.id ?? null,
      role: ChatMessageRole.ASSISTANT,
      content: state.llmCompletion.content,
      model: state.llmCompletion.model,
      latencyMs: state.llmCompletion.latencyMs,
      usage: state.llmCompletion.usage,
    });

    const nextTitle =
      state.dialog.title === DEFAULT_DIALOG_TITLE
        ? deriveTitleFromMessage(state.userContent)
        : undefined;

    const updatedDialog = await this.dialogsRepository.touchDialog(state.dialog.id, nextTitle);

    return {
      assistantMessage,
      updatedDialog,
    };
  }
}
