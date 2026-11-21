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
import type { AuthTcpRequestDto, DialogTcpRequestDto } from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS, ServiceName, UserRole } from '@semcache/shared-types';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureGatewayApp } from '../src/app.bootstrap';
import { AppModule } from '../src/app.module';

const capturedAuthRequests: Array<{ pattern: string; payload: AuthTcpRequestDto<unknown> }> = [];
const capturedDialogRequests: Array<{ pattern: string; payload: DialogTcpRequestDto<unknown> }> =
  [];

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
}

@Module({
  controllers: [MockDialogController],
})
class MockDialogModule {}

describe('API Gateway (e2e)', () => {
  let app: INestApplication<App>;
  let mockAuthMicroservice: INestMicroservice;
  let mockDialogMicroservice: INestMicroservice;
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

    const authAddress = mockAuthMicroservice.unwrap<Server>().address() as AddressInfo;
    const dialogAddress = mockDialogMicroservice.unwrap<Server>().address() as AddressInfo;
    process.env.AUTH_SERVICE_HOST = '127.0.0.1';
    process.env.AUTH_SERVICE_PORT = String(authAddress.port);
    process.env.DIALOG_SERVICE_HOST = '127.0.0.1';
    process.env.DIALOG_SERVICE_PORT = String(dialogAddress.port);

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
  });

  afterAll(async () => {
    await app.close();
    await mockAuthMicroservice.close();
    await mockDialogMicroservice.close();
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
});
