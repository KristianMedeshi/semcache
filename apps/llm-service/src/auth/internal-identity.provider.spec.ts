import type { ExecutionContext } from '@nestjs/common';
import { AuthenticationError, AuthenticationRegistry } from '@nestjs/authentication';
import { createSignedInternalHeaders } from '@semcache/shared-config';
import { UserRole } from '@semcache/shared-types';
import type { LlmConfigService } from '../config/llm-config.service';
import { InternalIdentityAuth } from './internal-identity.provider';

describe('InternalIdentityAuth', () => {
  const secret = 'test-internal-service-secret-32-chars!!';
  let registry: AuthenticationRegistry;
  let provider: InternalIdentityAuth;

  beforeEach(() => {
    registry = new AuthenticationRegistry();
    const config = { internalServiceSecret: secret } as LlmConfigService;
    provider = new InternalIdentityAuth(config, registry);
  });

  function createRpcContext(data: unknown): ExecutionContext {
    return {
      switchToRpc: () => ({
        getData: () => data,
      }),
    } as unknown as ExecutionContext;
  }

  it('registers itself with AuthenticationRegistry', () => {
    expect(registry.providers).toContain(provider);
  });

  it('returns null when no headers are present', () => {
    expect(provider.authenticate(createRpcContext({}))).toBeNull();
    expect(provider.authenticate(createRpcContext({ headers: {} }))).toBeNull();
  });

  it('returns the authenticated user for valid signed internal headers', () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: UserRole.CUSTOMER,
      sessionId: 'session-1',
    };
    const headers = createSignedInternalHeaders(user, secret);

    expect(provider.authenticate(createRpcContext({ headers }))).toEqual({ user });
  });

  it('throws AuthenticationError when the signature is invalid', () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: UserRole.CUSTOMER,
      sessionId: 'session-1',
    };
    const headers = createSignedInternalHeaders(user, 'different-secret-that-is-32-chars-long');

    expect(() => provider.authenticate(createRpcContext({ headers }))).toThrow(AuthenticationError);
  });
});
