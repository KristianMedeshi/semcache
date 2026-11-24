import { type ExecutionContext, Injectable, Optional } from '@nestjs/common';
import {
  AuthenticationError,
  AuthenticationProvider,
  AuthenticationRegistry,
  type AuthenticationResult,
} from '@nestjs/authentication';
import { ConfigService, isTestSecurityBypassEnabled } from '@semcache/shared-config';
import type { UserResponseDto } from '@semcache/shared-dtos';
import { UserRole } from '@semcache/shared-types';
import type { GatewayEnv } from '../config/gateway.env';
import { AuthProxyService } from './auth-proxy.service';

const TEST_BYPASS_DEFAULT_USER_ID = '00000000-0000-4000-8000-000000000001';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class GatewaySessionAuth extends AuthenticationProvider<UserResponseDto> {
  constructor(
    private readonly authProxyService: AuthProxyService,
    registry: AuthenticationRegistry,
    @Optional() private readonly config?: ConfigService<GatewayEnv, true>,
  ) {
    super();
    registry.registerProvider(this);
  }

  async authenticate(
    context: ExecutionContext,
  ): Promise<AuthenticationResult<UserResponseDto> | null> {
    const cookie = this.header(context, 'cookie');
    if (cookie) {
      const user = await this.authProxyService.resolveCurrentUser(cookie);
      if (!user) {
        throw new AuthenticationError('Invalid or expired session');
      }
      return { user };
    }

    if (this.isTestBypassActive()) {
      const requestedId = this.header(context, 'x-test-user-id')?.trim();
      const requestedRole = this.header(context, 'x-test-user-role')?.trim().toLowerCase();
      const id =
        requestedId && UUID_REGEX.test(requestedId) ? requestedId : TEST_BYPASS_DEFAULT_USER_ID;
      const role = requestedRole === UserRole.CUSTOMER ? UserRole.CUSTOMER : UserRole.ADMIN;

      return {
        user: {
          id,
          email:
            role === UserRole.ADMIN
              ? 'loadtest-admin@semcache.test'
              : 'loadtest-customer@semcache.test',
          role,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      };
    }

    return null;
  }

  private isTestBypassActive(): boolean {
    if (!this.config) {
      return false;
    }
    return isTestSecurityBypassEnabled(
      this.config.getOrThrow('NODE_ENV'),
      this.config.get('TEST_BYPASS_SECURITY'),
    );
  }
}
