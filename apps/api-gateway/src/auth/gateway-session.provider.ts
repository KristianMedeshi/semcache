import { type ExecutionContext, Injectable } from '@nestjs/common';
import {
  AuthenticationError,
  AuthenticationProvider,
  AuthenticationRegistry,
  type AuthenticationResult,
} from '@nestjs/authentication';
import type { UserResponseDto } from '@semcache/shared-dtos';
import { AuthProxyService } from './auth-proxy.service';

@Injectable()
export class GatewaySessionAuth extends AuthenticationProvider<UserResponseDto> {
  constructor(
    private readonly authProxyService: AuthProxyService,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  async authenticate(
    context: ExecutionContext,
  ): Promise<AuthenticationResult<UserResponseDto> | null> {
    const cookie = this.header(context, 'cookie');
    if (!cookie) {
      return null;
    }

    const user = await this.authProxyService.resolveCurrentUser(cookie);
    if (!user) {
      throw new AuthenticationError('Invalid or expired session');
    }

    return { user };
  }
}
