import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ServiceName } from '@semcache/shared-types';

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

/**
 * Configuration parameters for session-based authentication and security controls.
 */
export interface AuthEnvironmentConfig {
  internalServiceSecret: string;
  sessionCookieName: string;
  sessionTtlMs: number;
  sessionIdleTimeoutMs: number;
  corsOrigin: string[];
  loginRateLimitWindowMs: number;
  loginRateLimitMaxAttempts: number;
  secureCookies: boolean;
}

export const DEFAULT_SESSION_COOKIE_NAME = 'semcache_sid';
export const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const DEFAULT_SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;

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
