import { type ExecutionContext, Injectable, Logger } from '@nestjs/common';
import {
  AuthenticationError,
  AuthenticationProvider,
  AuthenticationRegistry,
  type AuthenticationResult,
} from '@nestjs/authentication';
import {
  ConfigService,
  resolveSecretFromConfig,
  verifySignedInternalHeaders,
} from '@semcache/shared-config';
import type { AuthenticatedUser } from '@semcache/shared-types';
import type { LlmEnv } from '../config/llm.env';

interface InternalRpcPayload {
  headers?: Record<string, string | string[] | undefined>;
}

@Injectable()
export class InternalIdentityAuth extends AuthenticationProvider<AuthenticatedUser> {
  private readonly logger = new Logger(InternalIdentityAuth.name);
  private readonly internalServiceSecret: string;

  constructor(config: ConfigService<LlmEnv, true>, registry: AuthenticationRegistry) {
    super();
    this.internalServiceSecret = resolveSecretFromConfig(
      config,
      'INTERNAL_SERVICE_SECRET',
      config.getOrThrow('NODE_ENV'),
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
