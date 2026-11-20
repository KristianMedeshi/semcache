import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  DialogMessageResponseDto,
  DialogResponseDto,
  LlmChatCompletionResponseDto,
  LlmChatMessageDto,
  SendMessageResponseDto,
} from '@semcache/shared-dtos';
import { ChatMessageRole } from '@semcache/shared-types';
import { DialogConfigService } from '../config/dialog-config.service';
import { DEFAULT_DIALOG_TITLE, DialogsRepository } from './dialogs.repository';

const CUSTOMER_SUPPORT_SYSTEM_PROMPT =
  'You are a helpful, concise customer support assistant for SemCache. Answer clearly and accurately.';

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
    private readonly config: DialogConfigService,
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
    let response: globalThis.Response;
    try {
      response = await fetch(`${this.config.llmServiceUrl}/llm/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: state.history,
          ...(state.requestedModel ? { model: state.requestedModel } : {}),
        }),
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'dialog.llm_service.network_error',
          dialogId: state.dialog.id,
          error: error instanceof Error ? error.message : 'Unknown network error',
        }),
      );
      throw new BadGatewayException('LLM service unavailable');
    }

    if (!response.ok) {
      const errorMessage = await this.extractUpstreamErrorMessage(response);
      if (response.status === 400) {
        throw new BadRequestException(errorMessage);
      }
      if (response.status === 503) {
        throw new ServiceUnavailableException(errorMessage);
      }
      throw new BadGatewayException(errorMessage);
    }

    const llmCompletion = (await response.json()) as LlmChatCompletionResponseDto;
    return { llmCompletion };
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

  private async extractUpstreamErrorMessage(response: globalThis.Response): Promise<string> {
    try {
      const payload = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(payload.message)) {
        return payload.message.join(', ');
      }
      if (typeof payload.message === 'string' && payload.message.length > 0) {
        return payload.message;
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
    }
    return `LLM service error (HTTP ${response.status})`;
  }
}
