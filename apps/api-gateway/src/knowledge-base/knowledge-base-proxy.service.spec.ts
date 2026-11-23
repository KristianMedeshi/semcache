import { UnauthorizedException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { createValidatedConfigService } from '@semcache/shared-config';
import { INTERNAL_AUTH_HEADERS, SERVICE_TCP_PATTERNS, UserRole } from '@semcache/shared-types';
import type { Request, Response } from 'express';
import { of } from 'rxjs';
import { AuthProxyService } from '../auth/auth-proxy.service';
import { gatewayEnvSchema } from '../config/gateway.env';
import { KnowledgeBaseProxyService } from './knowledge-base-proxy.service';

const TEST_ADMIN = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function createKbProxyHarness(options?: {
  user?: typeof TEST_ADMIN | null;
  kbSendMock?: jest.Mock;
}) {
  const config = createValidatedConfigService(gatewayEnvSchema, { loadEnvFiles: false });
  const authClient = { send: jest.fn() } as unknown as ClientProxy;
  const kbSendMock = options?.kbSendMock ?? jest.fn();
  const kbClient = { send: kbSendMock } as unknown as ClientProxy;
  const authProxy = new AuthProxyService(config, authClient);
  jest
    .spyOn(authProxy, 'resolveCurrentUser')
    .mockResolvedValue(options?.user === undefined ? TEST_ADMIN : options.user);

  const proxy = new KnowledgeBaseProxyService(authProxy, kbClient);
  return { proxy, kbSendMock };
}

function createJsonResponseMock() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status, json } as unknown as Response, status, json };
}

describe('KnowledgeBaseProxyService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.INTERNAL_SERVICE_SECRET = 'test-internal-service-secret-32-chars';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('rejects unauthenticated requests before forwarding to knowledge-base-service', async () => {
    const { proxy } = createKbProxyHarness({ user: null });
    const req = { method: 'GET', headers: {} } as Request;
    const res = {} as Response;

    await expect(
      proxy.forwardKnowledgeBaseRequest(req, res, SERVICE_TCP_PATTERNS.KB_DOCUMENTS_LIST),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('forwards authenticated requests with signed internal identity headers', async () => {
    const kbSendMock = jest.fn(() => of([{ id: 'doc-1', title: 'FAQ' }]));
    const { proxy } = createKbProxyHarness({ kbSendMock });
    const req = { method: 'GET', headers: { cookie: 'semcache_sid=abc' } } as Request;
    const { res, status, json } = createJsonResponseMock();

    await proxy.forwardKnowledgeBaseRequest(req, res, SERVICE_TCP_PATTERNS.KB_DOCUMENTS_LIST);

    expect(kbSendMock).toHaveBeenCalledTimes(1);
    const [pattern, payload] = kbSendMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(pattern).toBe(SERVICE_TCP_PATTERNS.KB_DOCUMENTS_LIST);
    expect(payload.headers[INTERNAL_AUTH_HEADERS.USER_ID]).toBe(TEST_ADMIN.id);
    expect(payload.headers[INTERNAL_AUTH_HEADERS.SIGNATURE]).toMatch(/^[a-f0-9]{64}$/);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith([{ id: 'doc-1', title: 'FAQ' }]);
  });
});
