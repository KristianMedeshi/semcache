import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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

/**
 * Configuration parameters for session-based authentication and security controls.
 */
export interface AuthEnvironmentConfig {
  internalServiceSecret: string;
  sessionCookieName: string;
  sessionTtl: DurationValue;
  sessionIdleTimeout: DurationValue;
  corsOrigin: string[];
  loginRateLimitWindowMs: number;
  loginRateLimitMaxAttempts: number;
  secureCookies: boolean;
}

export const DEFAULT_SESSION_COOKIE_NAME = 'semcache_sid';
export const DEFAULT_SESSION_TTL: DurationValue = '24h';
export const DEFAULT_SESSION_IDLE_TIMEOUT: DurationValue = '30m';
export const DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
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

/**
 * Resolves a microservice's TCP host/port from dedicated env vars, with optional fallback
 * to a legacy URL env var and default service ports.
 */
export function resolveServiceTcpEndpoint(
  service: ServiceName,
  options?: { hostKey?: string; portKey?: string; urlKey?: string },
): TcpEndpointConfig {
  const hostEnv = options?.hostKey ? process.env[options.hostKey]?.trim() : undefined;
  const portEnv = options?.portKey ? process.env[options.portKey]?.trim() : undefined;
  const urlEnv = options?.urlKey ? process.env[options.urlKey]?.trim() : undefined;

  let parsedHost: string | undefined;
  let parsedPort: number | undefined;
  if ((!hostEnv || !portEnv) && urlEnv) {
    try {
      const parsed = new URL(urlEnv);
      if (parsed.hostname) {
        parsedHost = parsed.hostname;
      }
      if (parsed.port) {
        const numericPort = Number.parseInt(parsed.port, 10);
        if (!Number.isNaN(numericPort) && numericPort > 0) {
          parsedPort = numericPort;
        }
      }
    } catch {
      // Ignore malformed legacy URLs and fall back to defaults/explicit vars
    }
  }

  const host =
    (hostEnv && hostEnv.length > 0 ? hostEnv : undefined) ??
    parsedHost ??
    getOptionalEnv('HOST', DEFAULT_SERVICE_HOST);

  const port =
    options?.portKey && portEnv
      ? getPositiveIntEnv(options.portKey, DEFAULT_SERVICE_PORTS[service])
      : (parsedPort ?? DEFAULT_SERVICE_PORTS[service]);

  return { host, port };
}

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

/**
 * Reads a required environment variable or throws a descriptive startup error.
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Reads an optional environment variable with a fallback default.
 */
export function getOptionalEnv(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.trim() !== '' ? value : fallback;
}

/**
 * Parses an integer port or numeric configuration from environment variables.
 */
export function getNumericEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid integer, received: "${raw}"`);
  }
  return parsed;
}

/**
 * Walks up from `startDir` to the workspace root and loads `.env` files
 * without overwriting already-defined environment variables.
 */
export function loadEnv(startDir: string = process.cwd()): void {
  if (typeof process.loadEnvFile !== 'function') {
    return;
  }

  let currentDir = resolve(startDir);
  while (true) {
    const envPath = join(currentDir, '.env');
    if (existsSync(envPath)) {
      process.loadEnvFile(envPath);
    }

    if (existsSync(join(currentDir, 'pnpm-workspace.yaml'))) {
      break;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
}

/**
 * Resolves and validates NODE_ENV ('development' | 'production' | 'test').
 */
export function getNodeEnv(): NodeEnvironment {
  const raw = getOptionalEnv('NODE_ENV', 'development');
  if (raw === 'production' || raw === 'test' || raw === 'development') {
    return raw;
  }
  throw new Error(`Invalid NODE_ENV value: "${raw}"`);
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
const DURATION_STRING_REGEX = /^(\d+(?:\.\d+)?)(ms|s|m|h|d|w)$/;
const NUMERIC_DURATION_REGEX = /^\d+(?:\.\d+)?$/;

/**
 * Converts a NestJS-compatible `DurationValue` (ms number or `<number><unit>` string) to milliseconds.
 */
export function durationToMs(duration: DurationValue): number {
  let ms: number;
  if (typeof duration === 'number') {
    if (!Number.isFinite(duration) || duration < 0) {
      throw new Error(`Invalid duration ${duration}: must be a non-negative number of milliseconds`);
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
 * Parses a NestJS `DurationValue` environment variable (number of ms or `<number><ms|s|m|h|d|w>`).
 */
export function getDurationEnv(
  key: string,
  fallback: DurationValue,
  options?: { allowZero?: boolean },
): DurationValue {
  const raw = process.env[key]?.trim();
  if (!raw) {
    return fallback;
  }

  let parsed: DurationValue;
  if (NUMERIC_DURATION_REGEX.test(raw)) {
    parsed = Number(raw);
  } else if (DURATION_STRING_REGEX.test(raw)) {
    parsed = raw as DurationString;
  } else {
    throw new Error(
      `Environment variable ${key} must be a valid Duration (milliseconds or "<number><ms|s|m|h|d|w>"), received: "${raw}"`,
    );
  }

  const ms = durationToMs(parsed);
  if (!options?.allowZero && ms <= 0) {
    throw new Error(`Environment variable ${key} must be greater than 0`);
  }

  return parsed;
}

/**
 * Parses a positive integer environment variable (> 0) with fallback.
 */
export function getPositiveIntEnv(key: string, fallback: number): number {
  const value = getNumericEnv(key, fallback);
  if (value <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }
  return value;
}

/**
 * Parses comma-separated CORS origins from an environment variable.
 */
export function getCorsOriginsEnv(
  key: string = 'CORS_ORIGIN',
  fallback: string = DEFAULT_CORS_ORIGIN,
): string[] {
  const origins = getOptionalEnv(key, fallback)
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    throw new Error(`${key} must contain at least one valid origin`);
  }
  return origins;
}

/**
 * Resolves a secret from environment variables, enforcing minimum length and
 * generating an ephemeral random secret in non-production environments when unset.
 */
export function resolveSecretEnv(
  key: string,
  nodeEnv: NodeEnvironment,
  onEphemeralWarning?: (message: string) => void,
): string {
  const assertLength = (value: string): void => {
    if (value.length < MIN_INTERNAL_SECRET_LENGTH) {
      throw new Error(`${key} must be at least ${MIN_INTERNAL_SECRET_LENGTH} characters long`);
    }
  };

  if (nodeEnv === 'production') {
    const value = getRequiredEnv(key);
    assertLength(value);
    return value;
  }

  const optionalValue = getOptionalEnv(key, '');
  if (optionalValue.length > 0) {
    assertLength(optionalValue);
    return optionalValue;
  }

  if (nodeEnv === 'development') {
    onEphemeralWarning?.(
      `${key} is not configured; generating an ephemeral development-only secret`,
    );
  }
  return randomBytes(32).toString('hex');
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

export const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';
export const DEFAULT_OPENROUTER_TIMEOUT_MS = 180_000;

const INTERNAL_HEADER_PREFIX = 'x-internal-';
const FREE_MODEL_PATTERN = /^(openrouter\/free|[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+:free)$/;

/**
 * Validates that an OpenRouter model identifier is explicitly zero-cost (`openrouter/free` or `*:free`).
 */
export function isFreeOpenRouterModel(modelId: string): boolean {
  return FREE_MODEL_PATTERN.test(modelId.trim());
}

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
