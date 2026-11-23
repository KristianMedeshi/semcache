import type { AddressInfo, Server } from 'node:net';
import { Controller, type INestApplication, type INestMicroservice, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  MessagePattern,
  type MicroserviceOptions,
  Payload,
  RpcException,
  Transport,
} from '@nestjs/microservices';
import { Test, type TestingModule } from '@nestjs/testing';
import type {
  AuthTcpRequestDto,
  DialogMessageStreamEventDto,
  DialogTcpRequestDto,
  KnowledgeBaseTcpRequestDto,
} from '@semcache/shared-dtos';
import {
  ChatMessageRole,
  SERVICE_TCP_PATTERNS,
  ServiceName,
  UserRole,
} from '@semcache/shared-types';
import { type Observable, of } from 'rxjs';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureGatewayApp } from '../src/app.bootstrap';
import { AppModule } from '../src/app.module';

const capturedAuthRequests: Array<{ pattern: string; payload: AuthTcpRequestDto<unknown> }> = [];
const capturedDialogRequests: Array<{ pattern: string; payload: DialogTcpRequestDto<unknown> }> =
  [];
const capturedKbRequests: Array<{
  pattern: string;
  payload: KnowledgeBaseTcpRequestDto<unknown>;
}> = [];

@Controller()
class MockAuthController {
  @MessagePattern(SERVICE_TCP_PATTERNS.AUTH_LOGIN)
  login(@Payload() payload: AuthTcpRequestDto<unknown>) {
    capturedAuthRequests.push({ pattern: SERVICE_TCP_PATTERNS.AUTH_LOGIN, payload });
    return {
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'alice@example.com',
        role: UserRole.CUSTOMER,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      setCookie: 'semcache_sid=opaque-test-token; HttpOnly; Path=/; SameSite=Lax',
    };
  }

  @MessagePattern(SERVICE_TCP_PATTERNS.AUTH_ME)
  me(@Payload() payload: AuthTcpRequestDto<unknown>) {
    capturedAuthRequests.push({ pattern: SERVICE_TCP_PATTERNS.AUTH_ME, payload });
    if (!payload.headers?.cookie) {
      throw new RpcException({ statusCode: 401, message: 'Unauthorized' });
    }
    return {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'alice@example.com',
      role: UserRole.CUSTOMER,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
  }

  @MessagePattern(SERVICE_TCP_PATTERNS.ADMIN_USERS_LIST)
  listUsers(@Payload() payload: AuthTcpRequestDto<unknown>) {
    capturedAuthRequests.push({ pattern: SERVICE_TCP_PATTERNS.ADMIN_USERS_LIST, payload });
    throw new RpcException({ statusCode: 403, message: 'Forbidden resource' });
  }
}

@Module({
  controllers: [MockAuthController],
})
class MockAuthModule {}

@Controller()
class MockDialogController {
  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_LIST)
  listDialogs(@Payload() payload: DialogTcpRequestDto<unknown>) {
    capturedDialogRequests.push({ pattern: SERVICE_TCP_PATTERNS.DIALOGS_LIST, payload });
    return { ok: true, pattern: SERVICE_TCP_PATTERNS.DIALOGS_LIST };
  }

  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_UPDATE)
  updateDialog(@Payload() payload: DialogTcpRequestDto<{ title: string }>) {
    capturedDialogRequests.push({ pattern: SERVICE_TCP_PATTERNS.DIALOGS_UPDATE, payload });
    return {
      id: payload.dialogId,
      userId: '11111111-1111-4111-8111-111111111111',
      title: payload.body?.title ?? 'Renamed',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:01:00.000Z',
    };
  }

  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_DELETE)
  deleteDialog(@Payload() payload: DialogTcpRequestDto<unknown>) {
    capturedDialogRequests.push({ pattern: SERVICE_TCP_PATTERNS.DIALOGS_DELETE, payload });
    return { id: payload.dialogId, deleted: true };
  }

  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_DELETE_ALL)
  deleteAllDialogs(@Payload() payload: DialogTcpRequestDto<unknown>) {
    capturedDialogRequests.push({ pattern: SERVICE_TCP_PATTERNS.DIALOGS_DELETE_ALL, payload });
    return { deletedCount: 2, deleted: true };
  }

  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_EDIT)
  editMessage(@Payload() payload: DialogTcpRequestDto<{ content: string }>) {
    capturedDialogRequests.push({ pattern: SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_EDIT, payload });
    const dialogId = payload.dialogId ?? '11111111-1111-4111-8111-111111111111';
    return {
      dialog: {
        id: dialogId,
        userId: '11111111-1111-4111-8111-111111111111',
        title: 'Edited',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:01:00.000Z',
      },
      userMessage: {
        id: 'm-edited-1',
        dialogId,
        parentMessageId: null,
        role: ChatMessageRole.USER,
        content: payload.body?.content ?? 'Edited',
        model: null,
        latencyMs: null,
        usage: null,
        createdAt: '2026-01-01T00:01:00.000Z',
      },
      assistantMessage: {
        id: 'm-edited-2',
        dialogId,
        parentMessageId: 'm-edited-1',
        role: ChatMessageRole.ASSISTANT,
        content: 'Updated answer',
        model: 'openrouter/free',
        latencyMs: 50,
        usage: null,
        createdAt: '2026-01-01T00:01:01.000Z',
      },
    };
  }

  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_EDIT_STREAM)
  streamEditMessage(
    @Payload() payload: DialogTcpRequestDto<{ content: string }>,
  ): Observable<DialogMessageStreamEventDto> {
    capturedDialogRequests.push({
      pattern: SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_EDIT_STREAM,
      payload,
    });
    return this.streamMessages(payload);
  }

  @MessagePattern(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_STREAM)
  streamMessages(
    @Payload() payload: DialogTcpRequestDto<unknown>,
  ): Observable<DialogMessageStreamEventDto> {
    capturedDialogRequests.push({
      pattern: SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_STREAM,
      payload,
    });
    const dialogId = payload.dialogId ?? '11111111-1111-4111-8111-111111111111';
    const userMessage = {
      id: 'm-1',
      dialogId,
      role: ChatMessageRole.USER,
      content: 'Hello',
      model: null,
      latencyMs: null,
      usage: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const assistantMessage = {
      id: 'm-2',
      dialogId,
      role: ChatMessageRole.ASSISTANT,
      content: 'Streamed reply',
      model: 'openrouter/free',
      latencyMs: 50,
      usage: null,
      createdAt: '2026-01-01T00:00:01.000Z',
    };
    return of<DialogMessageStreamEventDto[]>(
      { type: 'user_message', userMessage },
      { type: 'delta', delta: 'Streamed ' },
      { type: 'delta', delta: 'reply' },
      {
        type: 'done',
        dialog: {
          id: dialogId,
          userId: '11111111-1111-4111-8111-111111111111',
          title: 'Hello',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:01.000Z',
        },
        userMessage,
        assistantMessage,
      },
    );
  }
}

@Module({
  controllers: [MockDialogController],
})
class MockDialogModule {}

@Controller()
class MockKbController {
  @MessagePattern(SERVICE_TCP_PATTERNS.KB_DOCUMENTS_LIST)
  listDocuments(@Payload() payload: KnowledgeBaseTcpRequestDto<unknown>) {
    capturedKbRequests.push({ pattern: SERVICE_TCP_PATTERNS.KB_DOCUMENTS_LIST, payload });
    return [{ id: 'doc-1', title: 'Roaming Policy', status: 'ready' }];
  }

  @MessagePattern(SERVICE_TCP_PATTERNS.KB_CONTEXT_RETRIEVE)
  retrieveContext(@Payload() payload: KnowledgeBaseTcpRequestDto<{ query: string }>) {
    capturedKbRequests.push({ pattern: SERVICE_TCP_PATTERNS.KB_CONTEXT_RETRIEVE, payload });
    return {
      query: payload.body?.query ?? '',
      hasRelevantContext: true,
      formattedContext: '[Source 1: Roaming Policy]\n25 GB EU roaming included.',
      results: [],
      sources: [],
    };
  }
}

@Module({
  controllers: [MockKbController],
})
class MockKbModule {}

describe('API Gateway (e2e)', () => {
  let app: INestApplication<App>;
  let mockAuthMicroservice: INestMicroservice;
  let mockDialogMicroservice: INestMicroservice;
  let mockKbMicroservice: INestMicroservice;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    mockAuthMicroservice = await NestFactory.createMicroservice<MicroserviceOptions>(
      MockAuthModule,
      {
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: 0 },
        logger: false,
      },
    );
    await mockAuthMicroservice.listen();

    mockDialogMicroservice = await NestFactory.createMicroservice<MicroserviceOptions>(
      MockDialogModule,
      {
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: 0 },
        logger: false,
      },
    );
    await mockDialogMicroservice.listen();

    mockKbMicroservice = await NestFactory.createMicroservice<MicroserviceOptions>(MockKbModule, {
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 0 },
      logger: false,
    });
    await mockKbMicroservice.listen();

    const authAddress = mockAuthMicroservice.unwrap<Server>().address() as AddressInfo;
    const dialogAddress = mockDialogMicroservice.unwrap<Server>().address() as AddressInfo;
    const kbAddress = mockKbMicroservice.unwrap<Server>().address() as AddressInfo;
    process.env.AUTH_SERVICE_HOST = '127.0.0.1';
    process.env.AUTH_SERVICE_PORT = String(authAddress.port);
    process.env.DIALOG_SERVICE_HOST = '127.0.0.1';
    process.env.DIALOG_SERVICE_PORT = String(dialogAddress.port);
    process.env.KNOWLEDGE_BASE_SERVICE_HOST = '127.0.0.1';
    process.env.KNOWLEDGE_BASE_SERVICE_PORT = String(kbAddress.port);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureGatewayApp(app);
    await app.init();
  });

  beforeEach(() => {
    capturedAuthRequests.length = 0;
    capturedDialogRequests.length = 0;
    capturedKbRequests.length = 0;
  });

  afterAll(async () => {
    await app.close();
    await mockAuthMicroservice.close();
    await mockDialogMicroservice.close();
    await mockKbMicroservice.close();
    process.env = { ...originalEnv };
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          service: ServiceName.API_GATEWAY,
          status: 'ok',
          timestamp: expect.any(String),
        });
      });
  });

  it('proxies /auth/login over TCP and relays Set-Cookie header', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'StrongPassword1!' })
      .expect(200);

    expect(res.body.email).toBe('alice@example.com');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(capturedAuthRequests).toHaveLength(1);
    expect(capturedAuthRequests[0]?.pattern).toBe(SERVICE_TCP_PATTERNS.AUTH_LOGIN);
  });

  it('strips forged x-internal-* headers before forwarding requests over TCP', async () => {
    await request(app.getHttpServer())
      .get('/admin/users')
      .set('x-internal-user-id', 'forged-admin')
      .set('x-internal-user-role', UserRole.ADMIN)
      .set('x-internal-auth-signature', 'deadbeef')
      .expect(403);

    expect(capturedAuthRequests).toHaveLength(1);
    expect(capturedAuthRequests[0]?.payload.headers?.['x-internal-user-id']).toBeUndefined();
    expect(capturedAuthRequests[0]?.payload.headers?.['x-internal-user-role']).toBeUndefined();
    expect(capturedAuthRequests[0]?.payload.headers?.['x-internal-auth-signature']).toBeUndefined();
  });

  it('rejects role escalation payloads at gateway ValidationPipe', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'escalate@example.com',
        password: 'StrongPassword1!',
        role: UserRole.ADMIN,
      })
      .expect(400);
  });

  it('blocks untrusted cross-site state-changing requests via enableCsrfProtection', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .set('Sec-Fetch-Site', 'cross-site')
      .set('Origin', 'https://evil.example.com')
      .send({ email: 'alice@example.com', password: 'StrongPassword1!' })
      .expect(403);
  });

  it('requires authentication on /dialogs and attaches signed internal headers over TCP when signed in', async () => {
    await request(app.getHttpServer()).get('/dialogs').expect(401);

    await request(app.getHttpServer())
      .get('/dialogs')
      .set('Cookie', 'semcache_sid=opaque-test-token')
      .expect(200);

    expect(capturedDialogRequests).toHaveLength(1);
    expect(capturedDialogRequests[0]?.payload.headers['x-internal-user-id']).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(capturedDialogRequests[0]?.payload.headers['x-internal-auth-signature']).toBeDefined();
  });

  it('rejects non-free model selection at gateway ValidationPipe', () => {
    return request(app.getHttpServer())
      .post('/dialogs/11111111-1111-4111-8111-111111111111/messages')
      .set('Cookie', 'semcache_sid=opaque-test-token')
      .send({ content: 'Hello', model: 'openai/gpt-4o' })
      .expect(400);
  });

  it('streams SSE events from POST /dialogs/:id/messages/stream', async () => {
    const res = await request(app.getHttpServer())
      .post('/dialogs/11111111-1111-4111-8111-111111111111/messages/stream')
      .set('Cookie', 'semcache_sid=opaque-test-token')
      .send({ content: 'Hello' })
      .expect(200);

    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('"type":"user_message"');
    expect(res.text).toContain('"type":"delta","delta":"Streamed "');
    expect(res.text).toContain('"type":"delta","delta":"reply"');
    expect(res.text).toContain('"type":"done"');
    expect(capturedDialogRequests).toHaveLength(1);
    expect(capturedDialogRequests[0]?.pattern).toBe(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_STREAM);
  });

  it('forwards PATCH /dialogs/:id, DELETE /dialogs/:id, and POST /dialogs/:id/messages/:messageId/edit', async () => {
    const dialogId = '11111111-1111-4111-8111-111111111111';
    const messageId = '22222222-2222-4222-8222-222222222222';

    const patchRes = await request(app.getHttpServer())
      .patch(`/dialogs/${dialogId}`)
      .set('Cookie', 'semcache_sid=opaque-test-token')
      .send({ title: 'Updated Title' })
      .expect(200);
    expect(patchRes.body.title).toBe('Updated Title');

    const editRes = await request(app.getHttpServer())
      .post(`/dialogs/${dialogId}/messages/${messageId}/edit`)
      .set('Cookie', 'semcache_sid=opaque-test-token')
      .send({ content: 'Edited question' })
      .expect(200);
    expect(editRes.body.userMessage.content).toBe('Edited question');

    const deleteRes = await request(app.getHttpServer())
      .delete(`/dialogs/${dialogId}`)
      .set('Cookie', 'semcache_sid=opaque-test-token')
      .expect(200);
    expect(deleteRes.body).toEqual({ id: dialogId, deleted: true });

    const deleteAllRes = await request(app.getHttpServer())
      .delete('/dialogs')
      .set('Cookie', 'semcache_sid=opaque-test-token')
      .expect(200);
    expect(deleteAllRes.body).toEqual({ deletedCount: 2, deleted: true });

    expect(capturedDialogRequests.map((r) => r.pattern)).toEqual([
      SERVICE_TCP_PATTERNS.DIALOGS_UPDATE,
      SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_EDIT,
      SERVICE_TCP_PATTERNS.DIALOGS_DELETE,
      SERVICE_TCP_PATTERNS.DIALOGS_DELETE_ALL,
    ]);
  });

  it('enforces RBAC and forwards /knowledge-base/documents and /knowledge-base/search over TCP', async () => {
    await request(app.getHttpServer()).get('/knowledge-base/documents').expect(401);

    await request(app.getHttpServer())
      .post('/knowledge-base/documents')
      .set('Cookie', 'semcache_sid=opaque-test-token')
      .send({ title: 'Unauthorized Customer Upload', content: 'Test' })
      .expect(403);

    const listRes = await request(app.getHttpServer())
      .get('/knowledge-base/documents')
      .set('Cookie', 'semcache_sid=opaque-test-token')
      .expect(200);
    expect(listRes.body).toEqual([{ id: 'doc-1', title: 'Roaming Policy', status: 'ready' }]);

    const searchRes = await request(app.getHttpServer())
      .post('/knowledge-base/search')
      .set('Cookie', 'semcache_sid=opaque-test-token')
      .send({ query: 'EU roaming allowance' })
      .expect(200);
    expect(searchRes.body.hasRelevantContext).toBe(true);
    expect(capturedKbRequests.map((r) => r.pattern)).toEqual([
      SERVICE_TCP_PATTERNS.KB_DOCUMENTS_LIST,
      SERVICE_TCP_PATTERNS.KB_CONTEXT_RETRIEVE,
    ]);
  });
});
