import { createHmac, timingSafeEqual } from 'node:crypto';
import { type AuthenticatedUser, INTERNAL_AUTH_HEADERS, UserRole } from '@semcache/shared-types';

const INTERNAL_HEADER_PREFIX = 'x-internal-';

/**
 * Strips any incoming `x-internal-*` headers from external requests so clients cannot
 * forge internal identity or role claims at the API Gateway boundary.
 */
export function stripForgedInternalHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  const sanitized: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!key.toLowerCase().startsWith(INTERNAL_HEADER_PREFIX)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Signs authenticated user identity context for downstream microservice calls.
 */
export function createSignedInternalHeaders(
  user: AuthenticatedUser,
  internalSecret: string,
): Record<string, string> {
  const payload = `${user.id}:${user.email}:${user.role}:${user.sessionId}`;
  const signature = createHmac('sha256', internalSecret).update(payload).digest('hex');

  return {
    [INTERNAL_AUTH_HEADERS.USER_ID]: user.id,
    [INTERNAL_AUTH_HEADERS.USER_EMAIL]: user.email,
    [INTERNAL_AUTH_HEADERS.USER_ROLE]: user.role,
    [INTERNAL_AUTH_HEADERS.SESSION_ID]: user.sessionId,
    [INTERNAL_AUTH_HEADERS.SIGNATURE]: signature,
  };
}

/**
 * Verifies signed internal identity headers in constant time.
 */
export function verifySignedInternalHeaders(
  headers: Record<string, string | string[] | undefined>,
  internalSecret: string,
): AuthenticatedUser | null {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }

  const id = normalized[INTERNAL_AUTH_HEADERS.USER_ID];
  const email = normalized[INTERNAL_AUTH_HEADERS.USER_EMAIL];
  const role = normalized[INTERNAL_AUTH_HEADERS.USER_ROLE];
  const sessionId = normalized[INTERNAL_AUTH_HEADERS.SESSION_ID];
  const signature = normalized[INTERNAL_AUTH_HEADERS.SIGNATURE];

  if (!id || !email || !role || !sessionId || !signature) {
    return null;
  }
  if (role !== UserRole.CUSTOMER && role !== UserRole.ADMIN) {
    return null;
  }
  if (!/^[a-f0-9]+$/i.test(signature)) {
    return null;
  }

  const payload = `${id}:${email}:${role}:${sessionId}`;
  const expected = createHmac('sha256', internalSecret).update(payload).digest();
  const provided = Buffer.from(signature, 'hex');
  if (expected.length !== provided.length) {
    return null;
  }

  if (!timingSafeEqual(expected, provided)) {
    return null;
  }

  return { id, email, role, sessionId };
}
