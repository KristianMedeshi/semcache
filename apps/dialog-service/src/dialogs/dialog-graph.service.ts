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
  RetrieveKnowledgeContextRequestDto,
  RetrieveKnowledgeContextResponseDto,
  SendMessageResponseDto,
} from '@semcache/shared-dtos';
import { ChatMessageRole, SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { Observable, type Subscription, firstValueFrom, timeout } from 'rxjs';
import type { DialogEnv } from '../config/dialog.env';
import { DEFAULT_DIALOG_TITLE, DialogsRepository } from './dialogs.repository';

export const LLM_SERVICE_CLIENT = Symbol('LLM_SERVICE_CLIENT');
export const KNOWLEDGE_BASE_SERVICE_CLIENT = Symbol('KNOWLEDGE_BASE_SERVICE_CLIENT');

const KB_RETRIEVAL_TIMEOUT_MS = 5_000;

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
  knowledgeContext: Annotation<RetrieveKnowledgeContextResponseDto | null>,
  history: Annotation<LlmChatMessageDto[]>,
  userMessage: Annotation<DialogMessageResponseDto | null>,
  llmCompletion: Annotation<LlmChatCompletionResponseDto | null>,
  assistantMessage: Annotation<DialogMessageResponseDto | null>,
  updatedDialog: Annotation<DialogResponseDto | null>,
});

type DialogTurnStateType = typeof DialogTurnState.State;

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
  ) {
    this.compiledGraph = new StateGraph(DialogTurnState)
      .addNode('record_user_message', (state) => this.recordUserMessage(state))
      .addNode('retrieve_knowledge_context', (state) => this.retrieveKnowledgeContext(state))
      .addNode('call_llm_service', (state) => this.callLlmService(state))
      .addNode('record_assistant_message', (state) => this.recordAssistantMessage(state))
      .addEdge(START, 'record_user_message')
      .addEdge('record_user_message', 'retrieve_knowledge_context')
      .addEdge('retrieve_knowledge_context', 'call_llm_service')
      .addEdge('call_llm_service', 'record_assistant_message')
      .addEdge('record_assistant_message', END)
      .compile();
  }

  private createInitialState(input: {
    dialog: DialogResponseDto;
    content: string;
    model?: string;
    parentMessageId?: string | null;
  }): DialogTurnStateType {
    return {
      dialog: input.dialog,
      userContent: input.content,
      requestedModel: input.model,
      parentMessageId: input.parentMessageId,
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
  }): Promise<SendMessageResponseDto> {
    const finalState = await this.compiledGraph.invoke(this.createInitialState(input));

    if (!finalState.userMessage || !finalState.assistantMessage || !finalState.updatedDialog) {
      throw new BadGatewayException('Dialog orchestration failed to produce a complete turn');
    }

    return {
      dialog: finalState.updatedDialog,
      userMessage: finalState.userMessage,
      assistantMessage: finalState.assistantMessage,
    };
  }

  streamTurn(input: {
    dialog: DialogResponseDto;
    content: string;
    model?: string;
    parentMessageId?: string | null;
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

        const { history: groundedHistory } = await this.retrieveKnowledgeContext({
          ...initialState,
          userMessage,
          history,
        });
        if (unsubscribed) {
          return;
        }

        const messagesForLlm = groundedHistory ?? history;
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

              void this.recordAssistantMessage({
                dialog: input.dialog,
                userContent: input.content,
                requestedModel: input.model,
                parentMessageId: input.parentMessageId,
                knowledgeContext: null,
                history: messagesForLlm,
                userMessage,
                llmCompletion: completionPayload,
                assistantMessage: null,
                updatedDialog: null,
              }).then(
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
    const existingMessages = await this.dialogsRepository.findMessagesByDialog(state.dialog.id);
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

    const branchMessages = buildBranchHistory([...existingMessages, userMessage], userMessage.id);
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
