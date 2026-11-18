import { INTERNAL_AUTH_HEADERS, UserRole } from '@semcache/shared-types';
import {
  createSignedInternalHeaders,
  stripForgedInternalHeaders,
  verifySignedInternalHeaders,
} from './internal-identity.util';

describe('internal-identity.util', () => {
  const secret = 'test-internal-service-secret-32-chars';

  it('strips forged x-internal-* headers while keeping standard headers', () => {
    const sanitized = stripForgedInternalHeaders({
      cookie: 'semcache_sid=abc',
      origin: 'http://localhost:5173',
      'x-internal-user-id': 'forged-id',
      'X-Internal-User-Role': 'admin',
      'x-internal-auth-signature': 'forged-sig',
    });

    expect(sanitized).toEqual({
      cookie: 'semcache_sid=abc',
      origin: 'http://localhost:5173',
    });
  });

  it('signs and verifies internal user identity headers', () => {
    const user = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'alice@example.com',
      role: UserRole.CUSTOMER,
      sessionId: 'hashed-session-id',
    };

    const headers = createSignedInternalHeaders(user, secret);
    expect(verifySignedInternalHeaders(headers, secret)).toEqual(user);
  });

  it('rejects tampered role or invalid signature', () => {
    const user = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'alice@example.com',
      role: UserRole.CUSTOMER,
      sessionId: 'hashed-session-id',
    };

    const headers = createSignedInternalHeaders(user, secret);
    headers[INTERNAL_AUTH_HEADERS.USER_ROLE] = UserRole.ADMIN;

    expect(verifySignedInternalHeaders(headers, secret)).toBeNull();
    expect(verifySignedInternalHeaders(headers, 'wrong-secret-32-characters-long!!')).toBeNull();
  });
});
