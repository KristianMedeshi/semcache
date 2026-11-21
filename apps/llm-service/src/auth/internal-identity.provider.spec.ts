import type { ExecutionContext } from '@nestjs/common';
import { AuthenticationError, AuthenticationRegistry } from '@nestjs/authentication';
import { createSignedInternalHeaders, createValidatedConfigService } from '@semcache/shared-config';
import { UserRole } from '@semcache/shared-types';
import { llmEnvSchema } from '../config/llm.env';
import { InternalIdentityAuth } from './internal-identity.provider';

describe('InternalIdentityAuth', () => {
  const secret = 'test-internal-service-secret-32-chars!!';
  const originalEnv = { ...process.env };
  let registry: AuthenticationRegistry;
  let provider: InternalIdentityAuth;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.INTERNAL_SERVICE_SECRET = secret;
    registry = new AuthenticationRegistry();
    const config = createValidatedConfigService(llmEnvSchema, { loadEnvFiles: false });
    provider = new InternalIdentityAuth(config, registry);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
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
