import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { extractRpcErrorPayload, formatRpcErrorMessage } from '@semcache/shared-config';
import type {
  DialogMessageResponseDto,
  DialogMessageStreamEventDto,
  DialogResponseDto,
  LlmChatCompletionRequestDto,
  LlmChatCompletionResponseDto,
  LlmChatMessageDto,
  LlmChatStreamEventDto,
  SendMessageResponseDto,
} from '@semcache/shared-dtos';
import { ChatMessageRole, SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { Observable, type Subscription, firstValueFrom } from 'rxjs';
import { DEFAULT_DIALOG_TITLE, DialogsRepository } from './dialogs.repository';

export const LLM_SERVICE_CLIENT = Symbol('LLM_SERVICE_CLIENT');

const CUSTOMER_SUPPORT_SYSTEM_PROMPT =
  'You are the official Telecom Assistant for SemCache Telecom. Help customers clearly, politely, and accurately with mobile plans and subscriptions, mobile internet and data usage, account balance and bill payments, international roaming, SIM and eSIM activation, network connectivity troubleshooting, and account management. Structure responses using clean Markdown headings, bullet points, or numbered steps when helpful. Never mention internal caching, similarity scores, or model identifiers.';

const DialogTurnState = Annotation.Root({
  dialog: Annotation<DialogResponseDto>,
  userContent: Annotation<string>,
  requestedModel: Annotation<string | undefined>,
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

@Injectable()
export class DialogGraphService {
  private readonly logger = new Logger(DialogGraphService.name);
  private readonly compiledGraph;

  constructor(
    private readonly dialogsRepository: DialogsRepository,
    @Inject(LLM_SERVICE_CLIENT) private readonly llmClient: ClientProxy,
  ) {
    this.compiledGraph = new StateGraph(DialogTurnState)
      .addNode('record_user_message', (state) => this.recordUserMessage(state))
      .addNode('call_llm_service', (state) => this.callLlmService(state))
      .addNode('record_assistant_message', (state) => this.recordAssistantMessage(state))
      .addEdge(START, 'record_user_message')
      .addEdge('record_user_message', 'call_llm_service')
      .addEdge('call_llm_service', 'record_assistant_message')
      .addEdge('record_assistant_message', END)
      .compile();
  }

  async executeTurn(input: {
    dialog: DialogResponseDto;
    content: string;
    model?: string;
  }): Promise<SendMessageResponseDto> {
    const finalState = await this.compiledGraph.invoke({
      dialog: input.dialog,
      userContent: input.content,
      requestedModel: input.model,
      history: [],
      userMessage: null,
      llmCompletion: null,
      assistantMessage: null,
      updatedDialog: null,
    });

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
  }): Observable<DialogMessageStreamEventDto> {
    return new Observable<DialogMessageStreamEventDto>((subscriber) => {
      let unsubscribed = false;
      let llmSubscription: Subscription | undefined;

      const start = async () => {
        const { userMessage, history } = await this.recordUserMessage({
          dialog: input.dialog,
          userContent: input.content,
          requestedModel: input.model,
          history: [],
          userMessage: null,
          llmCompletion: null,
          assistantMessage: null,
          updatedDialog: null,
        });

        if (unsubscribed || !userMessage || !history) {
          return;
        }

        subscriber.next({ type: 'user_message', userMessage });

        let accumulatedContent = '';
        let finalCompletion: LlmChatCompletionResponseDto | null = null;

        llmSubscription = this.llmClient
          .send<LlmChatStreamEventDto, LlmChatCompletionRequestDto>(
            SERVICE_TCP_PATTERNS.LLM_CHAT_STREAM,
            {
              messages: history,
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
                history,
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
    const userMessage = await this.dialogsRepository.insertMessage({
      dialogId: state.dialog.id,
      role: ChatMessageRole.USER,
      content: state.userContent,
    });

    const persistedMessages = await this.dialogsRepository.findMessagesByDialog(state.dialog.id);
    const history: LlmChatMessageDto[] = [
      { role: ChatMessageRole.SYSTEM, content: CUSTOMER_SUPPORT_SYSTEM_PROMPT },
      ...persistedMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    return {
      userMessage,
      history,
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
