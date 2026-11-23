import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  type AuthenticatedUser,
  INTERNAL_AUTH_HEADERS,
  ServiceName,
  UserRole,
} from '@semcache/shared-types';

export type NodeEnvironment = 'development' | 'production' | 'test';

export interface DatabaseEnvironmentConfig {
  databaseUrl: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
}

export interface ServiceEndpointConfig {
  service: ServiceName;
  defaultPort: number;
}

export type DurationUnit = 'ms' | 's' | 'm' | 'h' | 'd' | 'w';
export type DurationString = `${number}${DurationUnit}`;
export type DurationValue = number | DurationString;

export const DEFAULT_SESSION_COOKIE_NAME = 'semcache_sid';
export const DEFAULT_CORS_ORIGIN = 'http://localhost:5173,http://127.0.0.1:5173';
export const DEFAULT_CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;
export const MIN_INTERNAL_SECRET_LENGTH = 32;

export const DEFAULT_SERVICE_HOST = '127.0.0.1';
export const DEFAULT_TCP_TIMEOUT_MS = 30_000;

export interface TcpEndpointConfig {
  host: string;
  port: number;
}

/**
 * Default port mapping for local development across microservices.
 */
export const DEFAULT_SERVICE_PORTS: Record<ServiceName, number> = {
  [ServiceName.API_GATEWAY]: 3000,
  [ServiceName.AUTH_SERVICE]: 3001,
  [ServiceName.DIALOG_SERVICE]: 3002,
  [ServiceName.SEMANTIC_CACHE_SERVICE]: 3003,
  [ServiceName.LLM_SERVICE]: 3004,
  [ServiceName.KNOWLEDGE_BASE_SERVICE]: 3005,
};

export interface ExtractedRpcErrorPayload {
  statusCode?: number;
  message?: string | string[];
  error?: string;
  errorCode?: string;
}

/**
 * Extracts a structured HTTP-like error payload from an RPC error emitted by `@nestjs/microservices`.
 * Returns `null` for transport/connection failures that have no application status code.
 */
export function extractRpcErrorPayload(error: unknown): ExtractedRpcErrorPayload | null {
  const candidates: unknown[] = [error];
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    if ('error' in record) {
      candidates.push(record.error);
    }
    if ('response' in record) {
      candidates.push(record.response);
    }
    if (typeof (record as { getError?: unknown }).getError === 'function') {
      candidates.push((record as { getError: () => unknown }).getError());
    }
  }

  for (const candidate of candidates) {
    if (typeof candidate !== 'object' || candidate === null) {
      continue;
    }
    const record = candidate as Record<string, unknown>;
    if (
      typeof record.statusCode === 'number' &&
      Number.isInteger(record.statusCode) &&
      record.statusCode >= 400 &&
      record.statusCode <= 599
    ) {
      return {
        statusCode: record.statusCode,
        ...(typeof record.message === 'string' || Array.isArray(record.message)
          ? { message: record.message as string | string[] }
          : {}),
        ...(typeof record.error === 'string' ? { error: record.error } : {}),
        ...(typeof record.errorCode === 'string' ? { errorCode: record.errorCode } : {}),
      };
    }
  }

  return null;
}

/**
 * Formats an extracted RPC error payload message into a single readable string.
 */
export function formatRpcErrorMessage(
  payload: { statusCode?: number; message?: string | string[] },
  fallbackPrefix: string,
): string {
  if (Array.isArray(payload.message)) {
    const joined = payload.message.filter((m): m is string => typeof m === 'string').join(', ');
    if (joined.length > 0) {
      return joined;
    }
  }
  if (typeof payload.message === 'string' && payload.message.length > 0) {
    return payload.message;
  }
  return `${fallbackPrefix} (status ${payload.statusCode ?? 'unknown'})`;
}

const DURATION_UNIT_MS: Record<DurationUnit, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

const MAX_DURATION_MS = 100 * 365.25 * 86_400_000;
export const DURATION_STRING_REGEX = /^(\d+(?:\.\d+)?)(ms|s|m|h|d|w)$/;
export const NUMERIC_DURATION_REGEX = /^\d+(?:\.\d+)?$/;

/**
 * Converts a NestJS-compatible `DurationValue` (ms number or `<number><unit>` string) to milliseconds.
 */
export function durationToMs(duration: DurationValue): number {
  let ms: number;
  if (typeof duration === 'number') {
    if (!Number.isFinite(duration) || duration < 0) {
      throw new Error(
        `Invalid duration ${duration}: must be a non-negative number of milliseconds`,
      );
    }
    ms = duration;
  } else {
    const match = DURATION_STRING_REGEX.exec(duration);
    if (!match) {
      throw new Error(
        `Invalid duration "${duration}": expected milliseconds or a string like "30m", "24h", or "7d"`,
      );
    }
    const unit = match[2] as DurationUnit;
    ms = Math.round(Number(match[1]) * DURATION_UNIT_MS[unit]);
  }

  if (ms > MAX_DURATION_MS) {
    throw new Error(`Invalid duration "${duration}": exceeds maximum of 100 years`);
  }

  return ms;
}

/**
 * Builds standard CORS options for credentialed browser requests.
 */
export function buildCorsOptions(corsOrigin: string[]): {
  origin: string[];
  credentials: true;
  methods: string[];
} {
  return {
    origin: corsOrigin,
    credentials: true,
    methods: [...DEFAULT_CORS_METHODS],
  };
}

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
