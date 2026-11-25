import {
  BadGatewayException,
  HttpException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticationContext } from '@nestjs/authentication';
import type { ClientProxy } from '@nestjs/microservices';
import { extractRpcErrorPayload } from '@semcache/shared-config';
import type { Request } from 'express';
import { firstValueFrom } from 'rxjs';
import type { AuthProxyService } from '../auth/auth-proxy.service';

export abstract class BaseTcpProxyService {
  protected abstract readonly logger: Logger;

  protected constructor(
    protected readonly authProxyService: AuthProxyService,
    protected readonly authContext?: AuthenticationContext,
  ) {}

  protected async buildIdentityHeaders(
    req: Request,
    sessionId: string,
  ): Promise<Record<string, string>> {
    const user =
      this.authContext?.user ??
      (await this.authProxyService.resolveCurrentUser(req.headers.cookie));
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.authProxyService.buildDownstreamIdentityHeaders({
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    });
  }

  protected async sendTcp<TResult = unknown, TPayload = unknown>(
    client: ClientProxy,
    pattern: string,
    payload: TPayload,
    errorEvent: string,
    unavailableMessage: string,
  ): Promise<TResult> {
    try {
      return await firstValueFrom(client.send<TResult>(pattern, payload));
    } catch (error) {
      throw this.mapRpcError(error, pattern, errorEvent, unavailableMessage);
    }
  }

  protected mapRpcError(
    error: unknown,
    pattern: string,
    errorEvent: string,
    unavailableMessage: string,
  ): HttpException {
    const rpcError = extractRpcErrorPayload(error);
    if (rpcError?.statusCode) {
      return new HttpException(rpcError, rpcError.statusCode);
    }

    this.logger.error(
      JSON.stringify({
        event: errorEvent,
        pattern,
        error: error instanceof Error ? error.message : 'Unknown TCP error',
      }),
    );
    return new BadGatewayException(unavailableMessage);
  }
}
