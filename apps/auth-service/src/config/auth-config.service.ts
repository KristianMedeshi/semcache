import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  type AuthEnvironmentConfig,
  DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS,
  DEFAULT_SESSION_COOKIE_NAME,
  DEFAULT_SESSION_IDLE_TIMEOUT_MS,
  DEFAULT_SESSION_TTL_MS,
  type NodeEnvironment,
  getNumericEnv,
  getOptionalEnv,
  getRequiredEnv,
} from '@semcache/shared-config';

const MIN_SECRET_LENGTH = 32;

@Injectable()
export class AuthConfigService implements AuthEnvironmentConfig {
  private readonly logger = new Logger(AuthConfigService.name);

  readonly nodeEnv: NodeEnvironment;
  readonly databaseUrl: string;
  readonly internalServiceSecret: string;
  readonly sessionCookieName: string;
  readonly sessionTtlMs: number;
  readonly sessionIdleTimeoutMs: number;
  readonly corsOrigin: string[];
  readonly loginRateLimitWindowMs: number;
  readonly loginRateLimitMaxAttempts: number;
  readonly secureCookies: boolean;

  constructor() {
    this.nodeEnv = this.resolveNodeEnv();
    const isProduction = this.nodeEnv === 'production';
    const isTest = this.nodeEnv === 'test';

    this.databaseUrl = isTest ? getOptionalEnv('DATABASE_URL', '') : getRequiredEnv('DATABASE_URL');

    this.internalServiceSecret = this.resolveSecret('INTERNAL_SERVICE_SECRET', isProduction);

    this.sessionCookieName = getOptionalEnv('SESSION_COOKIE_NAME', DEFAULT_SESSION_COOKIE_NAME);

    this.sessionTtlMs = this.resolvePositiveInt('SESSION_TTL_MS', DEFAULT_SESSION_TTL_MS);
    this.sessionIdleTimeoutMs = this.resolvePositiveInt(
      'SESSION_IDLE_TIMEOUT_MS',
      DEFAULT_SESSION_IDLE_TIMEOUT_MS,
    );

    this.loginRateLimitWindowMs = this.resolvePositiveInt(
      'LOGIN_RATE_LIMIT_WINDOW_MS',
      DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS,
    );
    this.loginRateLimitMaxAttempts = this.resolvePositiveInt(
      'LOGIN_RATE_LIMIT_MAX_ATTEMPTS',
      DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    );

    const rawCorsOrigin = getOptionalEnv(
      'CORS_ORIGIN',
      'http://localhost:5173,http://127.0.0.1:5173',
    );
    this.corsOrigin = rawCorsOrigin
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);

    if (this.corsOrigin.length === 0) {
      throw new Error('CORS_ORIGIN must contain at least one valid origin');
    }

    const secureCookieOverride = getOptionalEnv('SECURE_COOKIES', '');
    this.secureCookies =
      secureCookieOverride === 'true'
        ? true
        : secureCookieOverride === 'false'
          ? false
          : isProduction;
  }

  private resolveNodeEnv(): NodeEnvironment {
    const raw = getOptionalEnv('NODE_ENV', 'development');
    if (raw === 'production' || raw === 'test' || raw === 'development') {
      return raw;
    }
    throw new Error(`Invalid NODE_ENV value: "${raw}"`);
  }

  private resolveSecret(envKey: string, isProduction: boolean): string {
    if (isProduction) {
      const value = getRequiredEnv(envKey);
      this.assertSecretLength(envKey, value);
      return value;
    }

    const optionalValue = getOptionalEnv(envKey, '');
    if (optionalValue.length > 0) {
      this.assertSecretLength(envKey, optionalValue);
      return optionalValue;
    }

    if (this.nodeEnv === 'development') {
      this.logger.warn(
        `${envKey} is not configured; generating an ephemeral development-only secret`,
      );
    }
    return randomBytes(32).toString('hex');
  }

  private assertSecretLength(envKey: string, value: string): void {
    if (value.length < MIN_SECRET_LENGTH) {
      throw new Error(`${envKey} must be at least ${MIN_SECRET_LENGTH} characters long`);
    }
  }

  private resolvePositiveInt(envKey: string, fallback: number): number {
    const value = getNumericEnv(envKey, fallback);
    if (value <= 0) {
      throw new Error(`${envKey} must be a positive integer`);
    }
    return value;
  }
}
