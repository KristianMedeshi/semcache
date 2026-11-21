import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type DurationValue,
  type NodeEnvironment,
  createValidatedConfigService,
  resolveSecretFromConfig,
} from '@semcache/shared-config';
import { type AuthEnvironmentConfig, authEnvSchema } from './auth.env';

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

  constructor(
    @Optional()
    private readonly configService: ConfigService = createValidatedConfigService(authEnvSchema),
  ) {
    this.nodeEnv = this.configService.getOrThrow<NodeEnvironment>('NODE_ENV');
    const isProduction = this.nodeEnv === 'production';

    this.databaseUrl = this.configService.get<string>('DATABASE_URL') ?? '';
    this.internalServiceSecret = resolveSecretFromConfig(
      this.configService,
      'INTERNAL_SERVICE_SECRET',
      this.nodeEnv,
      (msg: string) => this.logger.warn(msg),
    );
    this.sessionCookieName = this.configService.getOrThrow<string>('SESSION_COOKIE_NAME');
    this.sessionTtl = this.configService.getOrThrow<DurationValue>('SESSION_TTL');
    this.sessionIdleTimeout = this.configService.getOrThrow<DurationValue>('SESSION_IDLE_TIMEOUT');
    this.loginRateLimitWindowMs = this.configService.getOrThrow<number>(
      'LOGIN_RATE_LIMIT_WINDOW_MS',
    );
    this.loginRateLimitMaxAttempts = this.configService.getOrThrow<number>(
      'LOGIN_RATE_LIMIT_MAX_ATTEMPTS',
    );
    this.corsOrigin = this.configService.getOrThrow<string[]>('CORS_ORIGIN');

    const secureCookieOverride = this.configService.get<string>('SECURE_COOKIES') ?? '';
    this.secureCookies =
      secureCookieOverride === 'true'
        ? true
        : secureCookieOverride === 'false'
          ? false
          : isProduction;
  }
}
