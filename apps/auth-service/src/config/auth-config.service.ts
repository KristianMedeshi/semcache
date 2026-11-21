import { Injectable, Logger } from '@nestjs/common';
import {
  type AuthEnvironmentConfig,
  DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS,
  DEFAULT_SESSION_COOKIE_NAME,
  DEFAULT_SESSION_IDLE_TIMEOUT,
  DEFAULT_SESSION_TTL,
  type DurationValue,
  type NodeEnvironment,
  getCorsOriginsEnv,
  getDurationEnv,
  getNodeEnv,
  getOptionalEnv,
  getPositiveIntEnv,
  getRequiredEnv,
  resolveSecretEnv,
} from '@semcache/shared-config';

@Injectable()
export class AuthConfigService implements AuthEnvironmentConfig {
  private readonly logger = new Logger(AuthConfigService.name);

  readonly nodeEnv: NodeEnvironment;
  readonly databaseUrl: string;
  readonly internalServiceSecret: string;
  readonly sessionCookieName: string;
  readonly sessionTtl: DurationValue;
  readonly sessionIdleTimeout: DurationValue;
  readonly corsOrigin: string[];
  readonly loginRateLimitWindowMs: number;
  readonly loginRateLimitMaxAttempts: number;
  readonly secureCookies: boolean;

  constructor() {
    this.nodeEnv = getNodeEnv();
    const isProduction = this.nodeEnv === 'production';
    const isTest = this.nodeEnv === 'test';

    this.databaseUrl = isTest ? getOptionalEnv('DATABASE_URL', '') : getRequiredEnv('DATABASE_URL');

    this.internalServiceSecret = resolveSecretEnv('INTERNAL_SERVICE_SECRET', this.nodeEnv, (msg) =>
      this.logger.warn(msg),
    );

    this.sessionCookieName = getOptionalEnv('SESSION_COOKIE_NAME', DEFAULT_SESSION_COOKIE_NAME);

    this.sessionTtl = getDurationEnv('SESSION_TTL', DEFAULT_SESSION_TTL);
    this.sessionIdleTimeout = getDurationEnv(
      'SESSION_IDLE_TIMEOUT',
      DEFAULT_SESSION_IDLE_TIMEOUT,
      { allowZero: true },
    );

    this.loginRateLimitWindowMs = getPositiveIntEnv(
      'LOGIN_RATE_LIMIT_WINDOW_MS',
      DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS,
    );
    this.loginRateLimitMaxAttempts = getPositiveIntEnv(
      'LOGIN_RATE_LIMIT_MAX_ATTEMPTS',
      DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    );

    this.corsOrigin = getCorsOriginsEnv();

    const secureCookieOverride = getOptionalEnv('SECURE_COOKIES', '');
    this.secureCookies =
      secureCookieOverride === 'true'
        ? true
        : secureCookieOverride === 'false'
          ? false
          : isProduction;
  }
}
