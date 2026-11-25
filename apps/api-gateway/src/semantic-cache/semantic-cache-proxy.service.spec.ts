import { BadGatewayException, UnauthorizedException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { SERVICE_TCP_PATTERNS, UserRole } from '@semcache/shared-types';
import { of, throwError } from 'rxjs';
import {
  createGatewayAuthProxyMock,
  createTestGatewayUser,
  expectSignedInternalHeaders,
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

    await expect(
      proxy.forwardSemanticCacheRequest(undefined, SERVICE_TCP_PATTERNS.CACHE_SETTINGS_GET),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('forwards authenticated requests with signed internal identity headers', async () => {
    const cacheSendMock = jest.fn(() => of({ mode: 'adaptive' }));
    const { proxy } = createProxyHarness({ cacheSendMock });

    const result = await proxy.forwardSemanticCacheRequest(
      'semcache_sid=abc',
      SERVICE_TCP_PATTERNS.CACHE_SETTINGS_GET,
    );

    expectSignedInternalHeaders(
      cacheSendMock,
      SERVICE_TCP_PATTERNS.CACHE_SETTINGS_GET,
      TEST_ADMIN.id,
    );
    expect(result).toEqual({ mode: 'adaptive' });
  });

  it('maps TCP transport errors to 502 BadGatewayException', async () => {
    const cacheSendMock = jest.fn(() => throwError(() => new Error('ECONNREFUSED')));
    const { proxy } = createProxyHarness({ cacheSendMock });

    await expect(
      proxy.forwardSemanticCacheRequest('semcache_sid=abc', SERVICE_TCP_PATTERNS.CACHE_STATS_GET),
    ).rejects.toThrow(BadGatewayException);
  });
});
