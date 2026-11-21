import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ConfigService,
  extractRpcErrorPayload,
  resolveSecretFromConfig,
} from '@semcache/shared-config';
import type { AuthTcpRequestDto, AuthTcpResponseDto, UserResponseDto } from '@semcache/shared-dtos';
import { type AuthenticatedUser, SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import type { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import type { GatewayEnv } from '../config/gateway.env';
import { createSignedInternalHeaders, stripForgedInternalHeaders } from './internal-identity.util';

export const AUTH_SERVICE_CLIENT = Symbol('AUTH_SERVICE_CLIENT');

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

  async forwardRequest(
    req: Request,
    res: Response,
    pattern: string,
    options?: { id?: string; body?: unknown; statusCode?: number },
  ): Promise<void> {
    const sanitizedIncoming = stripForgedInternalHeaders(req.headers);
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
      method: req.method,
      ...(req.ip ? { ip: req.ip } : {}),
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

    const statusCode = options?.statusCode ?? HttpStatus.OK;
    if (isAuthTcpResponse(result)) {
      if (result.setCookie) {
        res.setHeader('set-cookie', [result.setCookie]);
      }
      res.status(statusCode).json(result.data);
      return;
    }

    res.status(statusCode).json(result);
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
