import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Injectable, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { createSignedInternalHeaders } from '@semcache/shared-config';
import type {
  DialogMessageResponseDto,
  DialogResponseDto,
  LlmTokenUsageDto,
} from '@semcache/shared-dtos';
import { ChatMessageRole, ServiceName, UserRole } from '@semcache/shared-types';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DIALOG_PG_POOL } from '../src/db/database.module';
import { DEFAULT_DIALOG_TITLE, DialogsRepository } from '../src/dialogs/dialogs.repository';

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

  async insertMessage(input: {
    dialogId: string;
    role: ChatMessageRole;
    content: string;
    model?: string;
    latencyMs?: number;
    usage?: LlmTokenUsageDto;
  }): Promise<DialogMessageResponseDto> {
    const msg: DialogMessageResponseDto = {
      id: randomUUID(),
      dialogId: input.dialogId,
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

describe('Dialog Service (e2e)', () => {
  let app: INestApplication<App>;
  let mockLlmServer: Server;
  const originalEnv = { ...process.env };
  const secret = 'test-internal-service-secret-32-chars';

  beforeAll(async () => {
    mockLlmServer = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString('utf8');
      });
      req.on('end', () => {
        if (req.url === '/llm/chat' && req.method === 'POST') {
          const parsed = JSON.parse(body) as { model?: string };
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              content: 'Assistant answer via mocked LLM service',
              model: parsed.model ?? 'openrouter/free',
              latencyMs: 85,
              usage: { promptTokens: 20, completionTokens: 6, totalTokens: 26 },
            }),
          );
          return;
        }
        res.writeHead(404);
        res.end();
      });
    });

    await new Promise<void>((resolve) => {
      mockLlmServer.listen(0, '127.0.0.1', () => resolve());
    });
    const address = mockLlmServer.address() as AddressInfo;

    process.env.NODE_ENV = 'test';
    process.env.INTERNAL_SERVICE_SECRET = secret;
    process.env.LLM_SERVICE_URL = `http://127.0.0.1:${address.port}`;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DialogsRepository)
      .useClass(InMemoryDialogsRepository)
      .overrideProvider(DIALOG_PG_POOL)
      .useValue({ end: jest.fn().mockResolvedValue(undefined) })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await new Promise<void>((resolve, reject) => {
      mockLlmServer.close((err) => (err ? reject(err) : resolve()));
    });
    process.env = { ...originalEnv };
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          service: ServiceName.DIALOG_SERVICE,
          status: 'ok',
          timestamp: expect.any(String),
        });
      });
  });

  it('rejects requests without valid signed internal identity headers', () => {
    return request(app.getHttpServer()).get('/dialogs').expect(401);
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

    const createRes = await request(app.getHttpServer())
      .post('/dialogs')
      .set(internalHeaders)
      .send({})
      .expect(201);

    const dialogId = (createRes.body as DialogResponseDto).id;

    const turnRes = await request(app.getHttpServer())
      .post(`/dialogs/${dialogId}/messages`)
      .set(internalHeaders)
      .send({ content: 'Where is my invoice?', model: 'openrouter/free' })
      .expect(200);

    expect(turnRes.body.dialog.title).toBe('Where is my invoice?');
    expect(turnRes.body.assistantMessage.content).toBe('Assistant answer via mocked LLM service');
    expect(turnRes.body.assistantMessage.model).toBe('openrouter/free');

    const messagesRes = await request(app.getHttpServer())
      .get(`/dialogs/${dialogId}/messages`)
      .set(internalHeaders)
      .expect(200);

    expect(messagesRes.body).toHaveLength(2);
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

    const createRes = await request(app.getHttpServer())
      .post('/dialogs')
      .set(internalHeaders)
      .send({ title: 'Test' })
      .expect(201);

    const dialogId = (createRes.body as DialogResponseDto).id;

    await request(app.getHttpServer())
      .post(`/dialogs/${dialogId}/messages`)
      .set(internalHeaders)
      .send({ content: 'Hello', model: 'openai/gpt-4o' })
      .expect(400);
  });
});
