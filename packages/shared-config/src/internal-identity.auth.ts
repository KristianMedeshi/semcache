import { type ExecutionContext, Logger } from '@nestjs/common';
import {
  AuthenticationError,
  AuthenticationProvider,
  AuthenticationRegistry,
  type AuthenticationResult,
} from '@nestjs/authentication';
import type { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '@semcache/shared-types';
import { type NodeEnvironment, verifySignedInternalHeaders } from './constants';
import { resolveSecretFromConfig } from './shared-config.module';

export interface InternalRpcPayload {
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * Base `@nestjs/authentication` provider that verifies HMAC-signed internal identity
 * headers forwarded over NestJS TCP transport from `api-gateway`.
 */
export class BaseInternalIdentityAuth extends AuthenticationProvider<AuthenticatedUser> {
  private readonly logger: Logger;
  private readonly internalServiceSecret: string;

  constructor(
    config: ConfigService<Record<string, unknown>, true>,
    registry: AuthenticationRegistry,
    loggerName = BaseInternalIdentityAuth.name,
  ) {
    super();
    this.logger = new Logger(loggerName);
    this.internalServiceSecret = resolveSecretFromConfig(
      config,
      'INTERNAL_SERVICE_SECRET',
      config.getOrThrow('NODE_ENV') as NodeEnvironment,
      (msg: string) => this.logger.warn(msg),
    );
    registry.registerProvider(this);
  }

  authenticate(context: ExecutionContext): AuthenticationResult<AuthenticatedUser> | null {
    const data = context.switchToRpc().getData<InternalRpcPayload | undefined>();
    const headers = data?.headers;
    if (!headers || Object.keys(headers).length === 0) {
      return null;
    }

    const user = verifySignedInternalHeaders(headers, this.internalServiceSecret);
    if (!user) {
      throw new AuthenticationError('Invalid or missing internal identity signature');
    }

    return { user };
  }
}
