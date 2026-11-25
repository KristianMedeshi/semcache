import { BadGatewayException, UnauthorizedException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { INTERNAL_AUTH_HEADERS, SERVICE_TCP_PATTERNS, UserRole } from '@semcache/shared-types';
import type { Request, Response } from 'express';
import { of, throwError } from 'rxjs';
import {
  createGatewayAuthProxyMock,
  createJsonResponseMock,
  createTestGatewayUser,
  useTestGatewayEnv,
} from '../common/proxy-test-helpers';
import { SemanticCacheProxyService } from './semantic-cache-proxy.service';

const TEST_ADMIN = createTestGatewayUser(UserRole.ADMIN);

function createProxyHarness(options?: {
  user?: typeof TEST_ADMIN | null;
  cacheSendMock?: jest.Mock;
}) {
  const authProxy = createGatewayAuthProxyMock(
    options?.user === undefined ? TEST_ADMIN : options.user,
  );
  const cacheSendMock = options?.cacheSendMock ?? jest.fn();
  const cacheClient = { send: cacheSendMock } as unknown as ClientProxy;
  const proxy = new SemanticCacheProxyService(authProxy, cacheClient);
  return { proxy, cacheSendMock };
}

describe('SemanticCacheProxyService', () => {
  useTestGatewayEnv();

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
