import { randomUUID } from 'node:crypto';
import type { AddressInfo, Server } from 'node:net';
import { Controller, type INestMicroservice, Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  ClientProxy,
  ClientProxyFactory,
  MessagePattern,
  type MicroserviceOptions,
  Payload,
  Transport,
} from '@nestjs/microservices';
import { Test, type TestingModule } from '@nestjs/testing';
import { createSignedInternalHeaders, extractRpcErrorPayload } from '@semcache/shared-config';
import type {
  DialogMessageResponseDto,
  DialogMessageStreamEventDto,
  DialogResponseDto,
  LlmChatCompletionResponseDto,
  LlmChatStreamEventDto,
  LlmTokenUsageDto,
  SendMessageResponseDto,
} from '@semcache/shared-dtos';
import {
  ChatMessageRole,
  SERVICE_TCP_PATTERNS,
  ServiceName,
  UserRole,
} from '@semcache/shared-types';
import { type Observable, firstValueFrom, of, toArray } from 'rxjs';
import { AppModule } from '../src/app.module';
import { DIALOG_PG_POOL } from '../src/db/database.module';
import { DEFAULT_DIALOG_TITLE, DialogsRepository } from '../src/dialogs/dialogs.repository';

@Controller()
class MockLlmController {
  @MessagePattern(SERVICE_TCP_PATTERNS.LLM_CHAT)
  chat(@Payload() payload: { model?: string }): LlmChatCompletionResponseDto {
    return {
      content: 'Assistant answer via mocked LLM service',
      model: payload.model ?? 'openrouter/free',
      latencyMs: 85,
      usage: { promptTokens: 20, completionTokens: 6, totalTokens: 26 },
    };
  }

  @MessagePattern(SERVICE_TCP_PATTERNS.LLM_CHAT_STREAM)
  streamChat(@Payload() payload: { model?: string }): Observable<LlmChatStreamEventDto> {
    return of<LlmChatStreamEventDto[]>(
      { type: 'delta', delta: 'Streamed ' },
      { type: 'delta', delta: 'assistant answer' },
      {
        type: 'done',
        completion: {
          content: 'Streamed assistant answer',
          model: payload.model ?? 'openrouter/free',
          latencyMs: 90,
          usage: { promptTokens: 18, completionTokens: 4, totalTokens: 22 },
        },
      },
    );
  }
}

@Module({
  controllers: [MockLlmController],
})
class MockLlmModule {}

@Injectable()
class InMemoryDialogsRepository {
  private readonly dialogRows = new Map<string, DialogResponseDto>();
  private readonly messageRows = new Map<string, DialogMessageResponseDto[]>();

  async createDialog(userId: string, title?: string): Promise<DialogResponseDto> {
    const now = new Date().toISOString();
    const dialog: DialogResponseDto = {
      id: randomUUID(),
      userId,
      title: title && title.trim().length > 0 ? title.trim() : DEFAULT_DIALOG_TITLE,
      createdAt: now,
      updatedAt: now,
    };
    this.dialogRows.set(dialog.id, dialog);
    this.messageRows.set(dialog.id, []);
    return dialog;
  }

  async findDialogsByUser(userId: string): Promise<DialogResponseDto[]> {
    return [...this.dialogRows.values()].filter((d) => d.userId === userId);
  }

  async findDialogByIdForUser(dialogId: string, userId: string): Promise<DialogResponseDto | null> {
    const dialog = this.dialogRows.get(dialogId);
    return dialog && dialog.userId === userId ? dialog : null;
  }

  async findMessagesByDialog(dialogId: string): Promise<DialogMessageResponseDto[]> {
    return [...(this.messageRows.get(dialogId) ?? [])];
  }

  async findMessageByIdForDialog(
    dialogId: string,
    messageId: string,
  ): Promise<DialogMessageResponseDto | null> {
    const messages = this.messageRows.get(dialogId) ?? [];
    return messages.find((m) => m.id === messageId) ?? null;
  }

  async insertMessage(input: {
    dialogId: string;
    parentMessageId?: string | null;
    role: ChatMessageRole;
    content: string;
    model?: string;
    latencyMs?: number;
    usage?: LlmTokenUsageDto;
  }): Promise<DialogMessageResponseDto> {
    const msg: DialogMessageResponseDto = {
      id: randomUUID(),
      dialogId: input.dialogId,
      parentMessageId: input.parentMessageId ?? null,
      role: input.role,
      content: input.content,
      model: input.model ?? null,
      latencyMs: input.latencyMs ?? null,
      usage: input.usage ?? null,
      createdAt: new Date().toISOString(),
    };
    const existing = this.messageRows.get(input.dialogId) ?? [];
    existing.push(msg);
    this.messageRows.set(input.dialogId, existing);
    return msg;
  }

  async updateDialogTitle(dialogId: string, title: string): Promise<DialogResponseDto> {
    const dialog = this.dialogRows.get(dialogId);
    if (!dialog) {
      throw new Error('Dialog not found');
    }
    const updated: DialogResponseDto = {
      ...dialog,
      title: title.trim(),
      updatedAt: new Date().toISOString(),
    };
    this.dialogRows.set(dialogId, updated);
    return updated;
  }

  async deleteDialog(dialogId: string): Promise<boolean> {
    this.messageRows.delete(dialogId);
    return this.dialogRows.delete(dialogId);
  }

  async touchDialog(dialogId: string, title?: string): Promise<DialogResponseDto> {
    const dialog = this.dialogRows.get(dialogId);
    if (!dialog) {
      throw new Error('Dialog not found');
    }
    const updated: DialogResponseDto = {
      ...dialog,
      title: title ?? dialog.title,
      updatedAt: new Date().toISOString(),
    };
    this.dialogRows.set(dialogId, updated);
    return updated;
  }
}

describe('Dialog Service (TCP e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  let mockLlmApp: INestMicroservice;
  const originalEnv = { ...process.env };
  const secret = 'test-internal-service-secret-32-chars';

  beforeAll(async () => {
    mockLlmApp = await NestFactory.createMicroservice<MicroserviceOptions>(MockLlmModule, {
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 0 },
      logger: false,
    });
    await mockLlmApp.listen();
    const llmAddress = mockLlmApp.unwrap<Server>().address() as AddressInfo;

    process.env.NODE_ENV = 'test';
    process.env.INTERNAL_SERVICE_SECRET = secret;
    process.env.LLM_SERVICE_HOST = '127.0.0.1';
    process.env.LLM_SERVICE_PORT = String(llmAddress.port);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DialogsRepository)
      .useClass(InMemoryDialogsRepository)
      .overrideProvider(DIALOG_PG_POOL)
      .useValue({ end: jest.fn().mockResolvedValue(undefined) })
      .compile();

    app = moduleFixture.createNestMicroservice<MicroserviceOptions>({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 0 },
    });
    await app.listen();

    const dialogAddress = app.unwrap<Server>().address() as AddressInfo;
    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: dialogAddress.port },
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
    await app.close();
    await mockLlmApp.close();
    process.env = { ...originalEnv };
  });

  it('app.health returns ServiceName.DIALOG_SERVICE health status', async () => {
    const res = await firstValueFrom(client.send(SERVICE_TCP_PATTERNS.APP_HEALTH, {}));
    expect(res).toEqual({
      service: ServiceName.DIALOG_SERVICE,
      status: 'ok',
      timestamp: expect.any(String),
    });
  });

  it('rejects requests without valid signed internal identity headers', async () => {
    let caughtError: unknown;
    try {
      await firstValueFrom(client.send(SERVICE_TCP_PATTERNS.DIALOGS_LIST, { headers: {} }));
    } catch (error) {
      caughtError = error;
    }

    expect(extractRpcErrorPayload(caughtError)?.statusCode).toBe(401);
  });

  it('creates a dialog, sends a message through LangGraph, and retrieves history', async () => {
    const internalHeaders = createSignedInternalHeaders(
      {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'customer@example.com',
        role: UserRole.CUSTOMER,
        sessionId: 'session-123',
      },
      secret,
    );

    const createdDialog = await firstValueFrom(
      client.send<DialogResponseDto>(SERVICE_TCP_PATTERNS.DIALOGS_CREATE, {
        headers: internalHeaders,
        body: {},
      }),
    );

    const turn = await firstValueFrom(
      client.send<SendMessageResponseDto>(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_SEND, {
        headers: internalHeaders,
        dialogId: createdDialog.id,
        body: { content: 'Where is my invoice?', model: 'openrouter/free' },
      }),
    );

    expect(turn.dialog.title).toBe('Where is my invoice?');
    expect(turn.assistantMessage.content).toBe('Assistant answer via mocked LLM service');
    expect(turn.assistantMessage.model).toBe('openrouter/free');

    const messages = await firstValueFrom(
      client.send<DialogMessageResponseDto[]>(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_LIST, {
        headers: internalHeaders,
        dialogId: createdDialog.id,
      }),
    );

    expect(messages).toHaveLength(2);
  });

  it('rejects non-free OpenRouter model requests with 400 Bad Request', async () => {
    const internalHeaders = createSignedInternalHeaders(
      {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'customer@example.com',
        role: UserRole.CUSTOMER,
        sessionId: 'session-123',
      },
      secret,
    );

    const createdDialog = await firstValueFrom(
      client.send<DialogResponseDto>(SERVICE_TCP_PATTERNS.DIALOGS_CREATE, {
        headers: internalHeaders,
        body: { title: 'Test' },
      }),
    );

    let caughtError: unknown;
    try {
      await firstValueFrom(
        client.send(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_SEND, {
          headers: internalHeaders,
          dialogId: createdDialog.id,
          body: { content: 'Hello', model: 'openai/gpt-4o' },
        }),
      );
    } catch (error) {
      caughtError = error;
    }

    expect(extractRpcErrorPayload(caughtError)?.statusCode).toBe(400);
  });

  it('streams user_message, delta chunks, and done over dialogs.messages.stream', async () => {
    const internalHeaders = createSignedInternalHeaders(
      {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'customer@example.com',
        role: UserRole.CUSTOMER,
        sessionId: 'session-123',
      },
      secret,
    );

    const createdDialog = await firstValueFrom(
      client.send<DialogResponseDto>(SERVICE_TCP_PATTERNS.DIALOGS_CREATE, {
        headers: internalHeaders,
        body: {},
      }),
    );

    const events = await firstValueFrom(
      client
        .send<DialogMessageStreamEventDto>(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_STREAM, {
          headers: internalHeaders,
          dialogId: createdDialog.id,
          body: { content: 'Stream my bill details', model: 'openrouter/free' },
        })
        .pipe(toArray()),
    );

    expect(events.map((e) => e.type)).toEqual(['user_message', 'delta', 'delta', 'done']);
    const doneEvent = events[3];
    expect(doneEvent).toMatchObject({
      type: 'done',
      dialog: { id: createdDialog.id, title: 'Stream my bill details' },
      assistantMessage: { content: 'Streamed assistant answer' },
    });

    const messages = await firstValueFrom(
      client.send<DialogMessageResponseDto[]>(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_LIST, {
        headers: internalHeaders,
        dialogId: createdDialog.id,
      }),
    );
    expect(messages).toHaveLength(2);
  });

  it('renames a dialog, edits a user message into a new branch, and deletes the dialog', async () => {
    const internalHeaders = createSignedInternalHeaders(
      {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'customer@example.com',
        role: UserRole.CUSTOMER,
        sessionId: 'session-123',
      },
      secret,
    );

    const createdDialog = await firstValueFrom(
      client.send<DialogResponseDto>(SERVICE_TCP_PATTERNS.DIALOGS_CREATE, {
        headers: internalHeaders,
        body: { title: 'Initial' },
      }),
    );

    const renamed = await firstValueFrom(
      client.send<DialogResponseDto>(SERVICE_TCP_PATTERNS.DIALOGS_UPDATE, {
        headers: internalHeaders,
        dialogId: createdDialog.id,
        body: { title: 'Renamed Conversation' },
      }),
    );
    expect(renamed.title).toBe('Renamed Conversation');

    const firstTurn = await firstValueFrom(
      client.send<SendMessageResponseDto>(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_SEND, {
        headers: internalHeaders,
        dialogId: createdDialog.id,
        body: { content: 'Original question' },
      }),
    );

    const editedTurn = await firstValueFrom(
      client.send<SendMessageResponseDto>(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_EDIT, {
        headers: internalHeaders,
        dialogId: createdDialog.id,
        messageId: firstTurn.userMessage.id,
        body: { content: 'Edited question' },
      }),
    );
    expect(editedTurn.userMessage.parentMessageId).toBeNull();
    expect(editedTurn.assistantMessage.parentMessageId).toBe(editedTurn.userMessage.id);

    const deleted = await firstValueFrom(
      client.send<{ id: string; deleted: boolean }>(SERVICE_TCP_PATTERNS.DIALOGS_DELETE, {
        headers: internalHeaders,
        dialogId: createdDialog.id,
      }),
    );
    expect(deleted).toEqual({ id: createdDialog.id, deleted: true });
  });
});
