import { END, START, StateGraph } from '@langchain/langgraph';
import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ConfigService } from '@semcache/shared-config';
import type {
  DialogMessageResponseDto,
  DialogMessageStreamEventDto,
  LlmChatCompletionRequestDto,
  LlmChatCompletionResponseDto,
  LlmChatMessageDto,
  LlmChatStreamEventDto,
  SemanticCacheTurnMetadataDto,
  SendMessageResponseDto,
} from '@semcache/shared-dtos';
import { ChatMessageRole, SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { Observable, type Subscriber, type Subscription, firstValueFrom } from 'rxjs';
import type { DialogEnv } from '../config/dialog.env';
import {
  emitCompletedStreamTurn,
  lookupDialogSemanticCache,
  retrieveDialogKnowledgeContext,
  storeDialogSemanticCache,
  translateLlmRpcError,
} from './dialog-downstream.client';
import {
  CUSTOMER_SUPPORT_SYSTEM_PROMPT,
  type DialogTurnInput,
  DialogTurnState,
  type DialogTurnStateType,
  buildBranchHistory,
  createInitialDialogTurnState,
  deriveTitleFromMessage,
  toSemanticCacheTurnMetadata,
} from './dialog-turn.helpers';
import { DEFAULT_DIALOG_TITLE, DialogsRepository } from './dialogs.repository';

export { buildBranchHistory, buildSystemPromptWithKnowledge, classifyQueryCategory } from './dialog-turn.helpers';

export const LLM_SERVICE_CLIENT = Symbol('LLM_SERVICE_CLIENT');
export const KNOWLEDGE_BASE_SERVICE_CLIENT = Symbol('KNOWLEDGE_BASE_SERVICE_CLIENT');
export const SEMANTIC_CACHE_SERVICE_CLIENT = Symbol('SEMANTIC_CACHE_SERVICE_CLIENT');

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

  async executeTurn(input: DialogTurnInput): Promise<SendMessageResponseDto> {
    const finalState = await this.compiledGraph.invoke(createInitialDialogTurnState(input));

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

  streamTurn(input: DialogTurnInput): Observable<DialogMessageStreamEventDto> {
    return new Observable<DialogMessageStreamEventDto>((subscriber) => {
      let unsubscribed = false;
      let llmSubscription: Subscription | undefined;

      const start = async () => {
        const initialState = createInitialDialogTurnState(input);
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
          await this.completeStreamTurn(
            { ...initialState, ...lookupState, userMessage, history },
            userMessage,
            cacheMeta,
            subscriber,
            () => unsubscribed,
          );
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
        llmSubscription = this.streamFromLlm({
          input,
          messagesForLlm,
          baseState: { ...initialState, ...lookupState, ...kbState, history: messagesForLlm, userMessage },
          userMessage,
          cacheMeta,
          subscriber,
          isUnsubscribed: () => unsubscribed,
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

  private streamFromLlm(params: {
    input: DialogTurnInput;
    messagesForLlm: LlmChatMessageDto[];
    baseState: DialogTurnStateType;
    userMessage: DialogMessageResponseDto;
    cacheMeta?: SemanticCacheTurnMetadataDto;
    subscriber: Subscriber<DialogMessageStreamEventDto>;
    isUnsubscribed: () => boolean;
  }): Subscription {
    let accumulatedContent = '';
    let finalCompletion: LlmChatCompletionResponseDto | null = null;

    return this.llmClient
      .send<LlmChatStreamEventDto, LlmChatCompletionRequestDto>(
        SERVICE_TCP_PATTERNS.LLM_CHAT_STREAM,
        {
          messages: params.messagesForLlm,
          ...(params.input.model ? { model: params.input.model } : {}),
        },
      )
      .subscribe({
        next: (event) => {
          if (params.isUnsubscribed()) {
            return;
          }
          if (event.type === 'delta') {
            accumulatedContent += event.delta;
            params.subscriber.next({ type: 'delta', delta: event.delta });
          } else if (event.type === 'done') {
            finalCompletion = event.completion;
          }
        },
        error: (error: unknown) => {
          if (!params.isUnsubscribed()) {
            params.subscriber.error(
              translateLlmRpcError(error, params.input.dialog.id, this.logger),
            );
          }
        },
        complete: () => {
          if (params.isUnsubscribed()) {
            return;
          }
          if (!finalCompletion) {
            params.subscriber.error(new BadGatewayException('Missing LLM completion payload'));
            return;
          }

          const fullState: DialogTurnStateType = {
            ...params.baseState,
            llmCompletion: {
              ...finalCompletion,
              content: finalCompletion.content || accumulatedContent,
            },
          };

          void this.storeSemanticCache(fullState)
            .then(() =>
              this.completeStreamTurn(
                fullState,
                params.userMessage,
                params.cacheMeta,
                params.subscriber,
                params.isUnsubscribed,
              ),
            )
            .catch((err: unknown) => {
              if (!params.isUnsubscribed()) {
                params.subscriber.error(err);
              }
            });
        },
      });
  }

  private completeStreamTurn(
    state: DialogTurnStateType,
    userMessage: DialogMessageResponseDto,
    cacheMeta: SemanticCacheTurnMetadataDto | undefined,
    subscriber: Subscriber<DialogMessageStreamEventDto>,
    isUnsubscribed: () => boolean,
  ): Promise<void> {
    return emitCompletedStreamTurn(
      () => this.recordAssistantMessage(state),
      userMessage,
      cacheMeta,
      subscriber,
      isUnsubscribed,
    );
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

    return { userMessage, history };
  }

  private lookupSemanticCache(state: DialogTurnStateType): Promise<Partial<DialogTurnStateType>> {
    return lookupDialogSemanticCache(state, {
      llmClient: this.llmClient,
      semanticCacheClient: this.semanticCacheClient,
      logger: this.logger,
    });
  }

  private storeSemanticCache(state: DialogTurnStateType): Promise<Partial<DialogTurnStateType>> {
    return storeDialogSemanticCache(state, {
      semanticCacheClient: this.semanticCacheClient,
      logger: this.logger,
    });
  }

  private retrieveKnowledgeContext(
    state: DialogTurnStateType,
  ): Promise<Partial<DialogTurnStateType>> {
    return retrieveDialogKnowledgeContext(state, {
      knowledgeBaseClient: this.knowledgeBaseClient,
      config: this.config,
      logger: this.logger,
    });
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
      throw translateLlmRpcError(error, state.dialog.id, this.logger);
    }
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

    return { assistantMessage, updatedDialog };
  }
}
