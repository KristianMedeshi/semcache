import { randomUUID } from 'node:crypto';
import type { AddressInfo, Server } from 'node:net';
import { Controller, type INestMicroservice, Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  type ClientProxy,
  MessagePattern,
  type MicroserviceOptions,
  Payload,
  Transport,
} from '@nestjs/microservices';
import { Test, type TestingModule } from '@nestjs/testing';
import { createSignedInternalHeaders, extractRpcErrorPayload } from '@semcache/shared-config';
import { createTcpMicroserviceTestClient } from '@semcache/shared-config/testing';
import type {
  DialogMessageResponseDto,
  DialogMessageStreamEventDto,
  DialogResponseDto,
  LlmChatCompletionResponseDto,
  LlmChatStreamEventDto,
  LlmTokenUsageDto,
  RetrieveKnowledgeContextResponseDto,
  SendMessageResponseDto,
} from '@semcache/shared-dtos';
import {
  ChatMessageRole,
  QueryCategory,
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

const capturedKbQueries: string[] = [];

@Controller()
class MockKbController {
  @MessagePattern(SERVICE_TCP_PATTERNS.KB_CONTEXT_RETRIEVE)
  retrieve(@Payload() payload: { body?: { query?: string } }): RetrieveKnowledgeContextResponseDto {
    const query = payload.body?.query ?? '';
    capturedKbQueries.push(query);
    return {
      query,
      hasRelevantContext: true,
      formattedContext:
        '[Source 1: Billing Policy | Category: billing | Section Chunk #1]\nInvoices are issued on the 1st of each month.',
      results: [],
      sources: [
        {
          documentId: 'kb-doc-1',
          documentTitle: 'Billing Policy',
          fileName: 'billing.md',
          category: QueryCategory.BILLING,
          chunkId: 'kb-chunk-1',
          chunkIndex: 0,
        },
      ],
    };
  }
}

@Module({
  controllers: [MockKbController],
})
class MockKbModule {}

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

  async deleteAllDialogsByUser(userId: string): Promise<number> {
    let deletedCount = 0;
    for (const [id, dialog] of this.dialogRows.entries()) {
      if (dialog.userId === userId) {
        this.dialogRows.delete(id);
        this.messageRows.delete(id);
        deletedCount += 1;
      }
    }
    return deletedCount;
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
  let mockKbApp: INestMicroservice;
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

    mockKbApp = await NestFactory.createMicroservice<MicroserviceOptions>(MockKbModule, {
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 0 },
      logger: false,
    });
    await mockKbApp.listen();
    const kbAddress = mockKbApp.unwrap<Server>().address() as AddressInfo;

    process.env.NODE_ENV = 'test';
    process.env.INTERNAL_SERVICE_SECRET = secret;
    process.env.LLM_SERVICE_HOST = '127.0.0.1';
    process.env.LLM_SERVICE_PORT = String(llmAddress.port);
    process.env.KNOWLEDGE_BASE_SERVICE_HOST = '127.0.0.1';
    process.env.KNOWLEDGE_BASE_SERVICE_PORT = String(kbAddress.port);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DialogsRepository)
      .useClass(InMemoryDialogsRepository)
      .overrideProvider(DIALOG_PG_POOL)
      .useValue({ end: jest.fn().mockResolvedValue(undefined) })
      .compile();

    ({ app, client } = await createTcpMicroserviceTestClient(moduleFixture));
  });

  afterAll(async () => {
    await client.close();
    await app.close();
    await mockLlmApp.close();
    await mockKbApp.close();
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

  function createCustomerHeaders() {
    return createSignedInternalHeaders(
      {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'customer@example.com',
        role: UserRole.CUSTOMER,
        sessionId: 'session-123',
      },
      secret,
    );
  }

  async function createDialog(headers: Record<string, string>, title?: string) {
    return firstValueFrom(
      client.send<DialogResponseDto>(SERVICE_TCP_PATTERNS.DIALOGS_CREATE, {
        headers,
        body: title ? { title } : {},
      }),
    );
  }

  it('creates a dialog, sends a message through LangGraph, and retrieves history', async () => {
    const internalHeaders = createCustomerHeaders();
    const createdDialog = await createDialog(internalHeaders);

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
    expect(capturedKbQueries).toContain('Where is my invoice?');

    const messages = await listDialogMessages(internalHeaders, createdDialog.id);
    expect(messages).toHaveLength(2);
  });

  async function listDialogMessages(headers: Record<string, string>, dialogId: string) {
    return firstValueFrom(
      client.send<DialogMessageResponseDto[]>(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_LIST, {
        headers,
        dialogId,
      }),
    );
  }

  it('rejects non-free OpenRouter model requests with 400 Bad Request', async () => {
    const internalHeaders = createCustomerHeaders();
    const createdDialog = await createDialog(internalHeaders, 'Test');

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

  it('deletes all dialogs for the authenticated user over dialogs.deleteAll', async () => {
    const internalHeaders = createCustomerHeaders();
    await createDialog(internalHeaders, 'First');
    await createDialog(internalHeaders, 'Second');

    const before = await firstValueFrom(
      client.send<DialogResponseDto[]>(SERVICE_TCP_PATTERNS.DIALOGS_LIST, {
        headers: internalHeaders,
      }),
    );

    const result = await firstValueFrom(
      client.send<{ deletedCount: number; deleted: true }>(
        SERVICE_TCP_PATTERNS.DIALOGS_DELETE_ALL,
        {
          headers: internalHeaders,
        },
      ),
    );

    expect(result).toEqual({ deletedCount: before.length, deleted: true });

    const remaining = await firstValueFrom(
      client.send<DialogResponseDto[]>(SERVICE_TCP_PATTERNS.DIALOGS_LIST, {
        headers: internalHeaders,
      }),
    );
    expect(remaining).toEqual([]);
  });

  it('streams user_message, delta chunks, and done over dialogs.messages.stream', async () => {
    const internalHeaders = createCustomerHeaders();
    const createdDialog = await createDialog(internalHeaders);

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

    const messages = await listDialogMessages(internalHeaders, createdDialog.id);
    expect(messages).toHaveLength(2);
  });

  it('renames a dialog, edits a user message into a new branch, and deletes the dialog', async () => {
    const internalHeaders = createCustomerHeaders();
    const createdDialog = await createDialog(internalHeaders, 'Initial');

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
