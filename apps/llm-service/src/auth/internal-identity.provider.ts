import { type ExecutionContext, Injectable } from '@nestjs/common';
import {
  AuthenticationError,
  AuthenticationProvider,
  AuthenticationRegistry,
  type AuthenticationResult,
} from '@nestjs/authentication';
import { verifySignedInternalHeaders } from '@semcache/shared-config';
import type { AuthenticatedUser } from '@semcache/shared-types';
import { LlmConfigService } from '../config/llm-config.service';

interface InternalRpcPayload {
  headers?: Record<string, string | string[] | undefined>;
}

@Injectable()
export class InternalIdentityAuth extends AuthenticationProvider<AuthenticatedUser> {
  constructor(
    private readonly config: LlmConfigService,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  authenticate(context: ExecutionContext): AuthenticationResult<AuthenticatedUser> | null {
    const data = context.switchToRpc().getData<InternalRpcPayload | undefined>();
    const headers = data?.headers;
    if (!headers || Object.keys(headers).length === 0) {
      return null;
    }

    const user = verifySignedInternalHeaders(headers, this.config.internalServiceSecret);
    if (!user) {
      throw new AuthenticationError('Invalid or missing internal identity signature');
    }

    return { user };
  }
}
