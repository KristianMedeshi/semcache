import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ServiceName, UserRole } from '@semcache/shared-types';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureGatewayApp } from '../src/app.bootstrap';
import { AppModule } from '../src/app.module';

describe('API Gateway (e2e)', () => {
  let app: INestApplication<App>;
  let mockAuthServer: Server;
  let capturedRequests: Array<{ method?: string; url?: string; headers: IncomingHttpHeaders }> = [];
  let previousAuthServiceUrl: string | undefined;

  beforeAll(async () => {
    mockAuthServer = createServer((req, res) => {
      capturedRequests.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
      });

      let rawBody = '';
      req.on('data', (chunk: Buffer) => {
        rawBody += chunk.toString('utf8');
      });

      req.on('end', () => {
        if (req.url === '/auth/login' && req.method === 'POST') {
          res.writeHead(200, {
            'content-type': 'application/json',
            'set-cookie': 'semcache_sid=opaque-test-token; HttpOnly; Path=/; SameSite=Lax',
          });
          res.end(
            JSON.stringify({
              id: '11111111-1111-4111-8111-111111111111',
              email: 'alice@example.com',
              role: UserRole.CUSTOMER,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            }),
          );
          return;
        }

        if (req.url === '/auth/me' && req.method === 'GET') {
          if (!req.headers.cookie) {
            res.writeHead(401, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ statusCode: 401, message: 'Unauthorized' }));
            return;
          }
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              id: '11111111-1111-4111-8111-111111111111',
              email: 'alice@example.com',
              role: UserRole.CUSTOMER,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            }),
          );
          return;
        }

        if (req.url === '/admin/users' && req.method === 'GET') {
          res.writeHead(403, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ statusCode: 403, message: 'Forbidden resource' }));
          return;
        }

        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(rawBody || JSON.stringify({ ok: true }));
      });
    });

    await new Promise<void>((resolve) => {
      mockAuthServer.listen(0, '127.0.0.1', () => resolve());
    });

    const address = mockAuthServer.address() as AddressInfo;
    previousAuthServiceUrl = process.env.AUTH_SERVICE_URL;
    process.env.AUTH_SERVICE_URL = `http://127.0.0.1:${address.port}`;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureGatewayApp(app);
    await app.init();
  });

  beforeEach(() => {
    capturedRequests = [];
  });

  afterAll(async () => {
    await app.close();
    await new Promise<void>((resolve, reject) => {
      mockAuthServer.close((err) => (err ? reject(err) : resolve()));
    });
    if (previousAuthServiceUrl === undefined) {
      delete process.env.AUTH_SERVICE_URL;
    } else {
      process.env.AUTH_SERVICE_URL = previousAuthServiceUrl;
    }
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

  it('proxies /auth/login and relays Set-Cookie header', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'StrongPassword1!' })
      .expect(200);

    expect(res.body.email).toBe('alice@example.com');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(capturedRequests).toHaveLength(1);
  });

  it('strips forged x-internal-* headers before forwarding requests', async () => {
    await request(app.getHttpServer())
      .get('/admin/users')
      .set('x-internal-user-id', 'forged-admin')
      .set('x-internal-user-role', UserRole.ADMIN)
      .set('x-internal-auth-signature', 'deadbeef')
      .expect(403);

    expect(capturedRequests).toHaveLength(1);
    expect(capturedRequests[0]?.headers['x-internal-user-id']).toBeUndefined();
    expect(capturedRequests[0]?.headers['x-internal-user-role']).toBeUndefined();
    expect(capturedRequests[0]?.headers['x-internal-auth-signature']).toBeUndefined();
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
});
