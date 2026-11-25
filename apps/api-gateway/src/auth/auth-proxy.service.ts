import { BadGatewayException, HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ConfigService,
  extractRpcErrorPayload,
  resolveSecretFromConfig,
} from '@semcache/shared-config';
import type { AuthTcpRequestDto, AuthTcpResponseDto, UserResponseDto } from '@semcache/shared-dtos';
import { type AuthenticatedUser, SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { firstValueFrom } from 'rxjs';
import type { GatewayEnv } from '../config/gateway.env';
import { createSignedInternalHeaders, stripForgedInternalHeaders } from './internal-identity.util';

export const AUTH_SERVICE_CLIENT = Symbol('AUTH_SERVICE_CLIENT');

export interface AuthForwardContext {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  ip?: string;
}

export interface AuthProxyResult<T = unknown> {
  data: T;
  setCookie?: string;
}

const FORWARDED_HEADERS = [
  'cookie',
  'origin',
  'referer',
  'sec-fetch-site',
  'user-agent',
  'x-forwarded-for',
] as const;

function isAuthTcpResponse(value: unknown): value is AuthTcpResponseDto<unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'data' in value;
}

@Injectable()
export class AuthProxyService {
  private readonly logger = new Logger(AuthProxyService.name);
  private readonly internalServiceSecret: string;

  constructor(
    config: ConfigService<GatewayEnv, true>,
    @Inject(AUTH_SERVICE_CLIENT) private readonly authClient: ClientProxy,
  ) {
    this.internalServiceSecret = resolveSecretFromConfig(
      config,
      'INTERNAL_SERVICE_SECRET',
      config.getOrThrow('NODE_ENV'),
      (msg: string) => this.logger.warn(msg),
    );
  }

  async forwardRequest<T = unknown>(
    ctx: AuthForwardContext,
    pattern: string,
    options?: { id?: string; body?: unknown },
  ): Promise<AuthProxyResult<T>> {
    const sanitizedIncoming = stripForgedInternalHeaders(ctx.headers);
    const forwardHeaders: Record<string, string> = {};

    for (const headerName of FORWARDED_HEADERS) {
      const value = sanitizedIncoming[headerName];
      if (typeof value === 'string' && value.length > 0) {
        forwardHeaders[headerName] = value;
      } else if (Array.isArray(value) && value.length > 0) {
        forwardHeaders[headerName] = value.join('; ');
      }
    }

    const requestPayload: AuthTcpRequestDto<unknown> = {
      headers: forwardHeaders,
      method: ctx.method,
      ...(ctx.ip ? { ip: ctx.ip } : {}),
      ...(options?.id !== undefined ? { id: options.id } : {}),
      ...(options?.body !== undefined ? { body: options.body } : {}),
    };

    let result: unknown;
    try {
      result = await firstValueFrom(this.authClient.send<unknown>(pattern, requestPayload));
    } catch (error) {
      const rpcError = extractRpcErrorPayload(error);
      if (rpcError?.statusCode) {
        throw new HttpException(rpcError, rpcError.statusCode);
      }

      this.logger.error(
        JSON.stringify({
          event: 'gateway.auth_proxy.network_error',
          pattern,
          error: error instanceof Error ? error.message : 'Unknown TCP error',
        }),
      );
      throw new BadGatewayException('Authentication service unavailable');
    }

    if (isAuthTcpResponse(result)) {
      return {
        data: result.data as T,
        ...(result.setCookie ? { setCookie: result.setCookie } : {}),
      };
    }

    return { data: result as T };
  }

  async resolveCurrentUser(cookieHeader?: string): Promise<UserResponseDto | null> {
    if (!cookieHeader) {
      return null;
    }

    try {
      const payload: AuthTcpRequestDto = {
        headers: { cookie: cookieHeader },
        method: 'GET',
      };
      return await firstValueFrom(
        this.authClient.send<UserResponseDto, AuthTcpRequestDto>(
          SERVICE_TCP_PATTERNS.AUTH_ME,
          payload,
        ),
      );
    } catch {
      return null;
    }
  }

  buildDownstreamIdentityHeaders(user: AuthenticatedUser): Record<string, string> {
    return createSignedInternalHeaders(user, this.internalServiceSecret);
  }
}
