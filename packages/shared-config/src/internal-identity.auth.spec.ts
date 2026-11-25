import type { ExecutionContext } from '@nestjs/common';
import { AuthenticationError, AuthenticationRegistry } from '@nestjs/authentication';
import { ConfigService } from '@nestjs/config';
import { INTERNAL_AUTH_HEADERS, UserRole } from '@semcache/shared-types';
import { createSignedInternalHeaders } from './constants';
import { BaseInternalIdentityAuth } from './internal-identity.auth';

function createRpcContext(headers?: Record<string, string | string[] | undefined>): ExecutionContext {
  return {
    switchToRpc: () => ({
      getData: () => (headers !== undefined ? { headers } : undefined),
    }),
  } as unknown as ExecutionContext;
}

describe('BaseInternalIdentityAuth', () => {
  const secret = 'test-internal-service-secret-32-chars';

  function createProvider() {
    const config = new ConfigService<Record<string, unknown>, true>({
      NODE_ENV: 'test',
      INTERNAL_SERVICE_SECRET: secret,
    });
    const registry = new AuthenticationRegistry();
    return { provider: new BaseInternalIdentityAuth(config, registry, 'TestIdentityAuth'), registry };
  }

  it('registers itself on the AuthenticationRegistry', () => {
    const { provider, registry } = createProvider();
    expect(registry.providers).toContain(provider);
  });

  it('returns null when RPC payload has no headers', () => {
    const { provider } = createProvider();
    expect(provider.authenticate(createRpcContext())).toBeNull();
    expect(provider.authenticate(createRpcContext({}))).toBeNull();
  });

  it('authenticates valid signed internal headers', () => {
    const { provider } = createProvider();
    const user = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      sessionId: 'sess-1',
    };
    const headers = createSignedInternalHeaders(user, secret);

    expect(provider.authenticate(createRpcContext(headers))).toEqual({ user });
  });

  it('throws AuthenticationError on forged or invalid signature', () => {
    const { provider } = createProvider();
    const headers = createSignedInternalHeaders(
      {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'customer@example.com',
        role: UserRole.CUSTOMER,
        sessionId: 'sess-1',
      },
      secret,
    );
    headers[INTERNAL_AUTH_HEADERS.USER_ROLE] = UserRole.ADMIN;

    expect(() => provider.authenticate(createRpcContext(headers))).toThrow(AuthenticationError);
  });
});
