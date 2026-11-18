import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_SERVICE_PORTS,
  DEFAULT_SESSION_COOKIE_NAME,
  type NodeEnvironment,
  getOptionalEnv,
  getRequiredEnv,
} from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';

const MIN_SECRET_LENGTH = 32;

@Injectable()
export class GatewayConfigService {
  private readonly logger = new Logger(GatewayConfigService.name);

  readonly nodeEnv: NodeEnvironment;
  readonly authServiceUrl: string;
  readonly internalServiceSecret: string;
  readonly sessionCookieName: string;
  readonly corsOrigin: string[];

  constructor() {
    this.nodeEnv = this.resolveNodeEnv();
    const isProduction = this.nodeEnv === 'production';

    const defaultAuthUrl = `http://localhost:${DEFAULT_SERVICE_PORTS[ServiceName.AUTH_SERVICE]}`;
    this.authServiceUrl = getOptionalEnv('AUTH_SERVICE_URL', defaultAuthUrl).replace(/\/+$/, '');
    this.sessionCookieName = getOptionalEnv('SESSION_COOKIE_NAME', DEFAULT_SESSION_COOKIE_NAME);
    this.internalServiceSecret = this.resolveSecret('INTERNAL_SERVICE_SECRET', isProduction);

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
      if (value.length < MIN_SECRET_LENGTH) {
        throw new Error(`${envKey} must be at least ${MIN_SECRET_LENGTH} characters long`);
      }
      return value;
    }

    const optionalValue = getOptionalEnv(envKey, '');
    if (optionalValue.length > 0) {
      if (optionalValue.length < MIN_SECRET_LENGTH) {
        throw new Error(`${envKey} must be at least ${MIN_SECRET_LENGTH} characters long`);
      }
      return optionalValue;
    }

    if (this.nodeEnv === 'development') {
      this.logger.warn(
        `${envKey} is not configured; generating an ephemeral development-only secret`,
      );
    }
    return randomBytes(32).toString('hex');
  }
}
