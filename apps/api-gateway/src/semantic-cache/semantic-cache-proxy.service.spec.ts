import { BadGatewayException, UnauthorizedException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { createValidatedConfigService } from '@semcache/shared-config';
import { INTERNAL_AUTH_HEADERS, SERVICE_TCP_PATTERNS, UserRole } from '@semcache/shared-types';
import type { Request, Response } from 'express';
import { of, throwError } from 'rxjs';
import { AuthProxyService } from '../auth/auth-proxy.service';
import { gatewayEnvSchema } from '../config/gateway.env';
import { SemanticCacheProxyService } from './semantic-cache-proxy.service';

const TEST_ADMIN = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function createProxyHarness(options?: {
  user?: typeof TEST_ADMIN | null;
  cacheSendMock?: jest.Mock;
}) {
  const config = createValidatedConfigService(gatewayEnvSchema, { loadEnvFiles: false });
  const authClient = { send: jest.fn() } as unknown as ClientProxy;
  const cacheSendMock = options?.cacheSendMock ?? jest.fn();
  const cacheClient = { send: cacheSendMock } as unknown as ClientProxy;
  const authProxy = new AuthProxyService(config, authClient);
  jest
    .spyOn(authProxy, 'resolveCurrentUser')
    .mockResolvedValue(options?.user === undefined ? TEST_ADMIN : options.user);

  const proxy = new SemanticCacheProxyService(authProxy, cacheClient);
  return { proxy, cacheSendMock };
}

function createJsonResponseMock() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status, json } as unknown as Response, status, json };
}

describe('SemanticCacheProxyService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.INTERNAL_SERVICE_SECRET = 'test-internal-service-secret-32-chars';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('rejects unauthenticated requests before forwarding to semantic-cache-service', async () => {
    const { proxy } = createProxyHarness({ user: null });
    const req = { method: 'GET', headers: {} } as Request;
    const res = {} as Response;

    await expect(
      proxy.forwardSemanticCacheRequest(req, res, SERVICE_TCP_PATTERNS.CACHE_SETTINGS_GET),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('forwards authenticated requests with signed internal identity headers', async () => {
    const cacheSendMock = jest.fn(() => of({ mode: 'adaptive' }));
    const { proxy } = createProxyHarness({ cacheSendMock });
    const req = { method: 'GET', headers: { cookie: 'semcache_sid=abc' } } as Request;
    const { res, status, json } = createJsonResponseMock();

    await proxy.forwardSemanticCacheRequest(req, res, SERVICE_TCP_PATTERNS.CACHE_SETTINGS_GET);

    expect(cacheSendMock).toHaveBeenCalledTimes(1);
    const [pattern, payload] = cacheSendMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(pattern).toBe(SERVICE_TCP_PATTERNS.CACHE_SETTINGS_GET);
    expect(payload.headers[INTERNAL_AUTH_HEADERS.USER_ID]).toBe(TEST_ADMIN.id);
    expect(payload.headers[INTERNAL_AUTH_HEADERS.SIGNATURE]).toMatch(/^[a-f0-9]{64}$/);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ mode: 'adaptive' });
  });

  it('maps TCP transport errors to 502 BadGatewayException', async () => {
    const cacheSendMock = jest.fn(() => throwError(() => new Error('ECONNREFUSED')));
    const { proxy } = createProxyHarness({ cacheSendMock });
    const req = { method: 'GET', headers: { cookie: 'semcache_sid=abc' } } as Request;
    const { res } = createJsonResponseMock();

    await expect(
      proxy.forwardSemanticCacheRequest(req, res, SERVICE_TCP_PATTERNS.CACHE_STATS_GET),
    ).rejects.toThrow(BadGatewayException);
  });
});
