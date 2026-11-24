import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticationContext } from '@nestjs/authentication';
import { ClientProxy } from '@nestjs/microservices';
import { extractRpcErrorPayload } from '@semcache/shared-config';
import type { SemanticCacheTcpRequestDto } from '@semcache/shared-dtos';
import type { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { AuthProxyService } from '../auth/auth-proxy.service';

export const SEMANTIC_CACHE_SERVICE_CLIENT = Symbol('SEMANTIC_CACHE_SERVICE_CLIENT');

@Injectable()
export class SemanticCacheProxyService {
  private readonly logger = new Logger(SemanticCacheProxyService.name);

  constructor(
    private readonly authProxyService: AuthProxyService,
    @Inject(SEMANTIC_CACHE_SERVICE_CLIENT) private readonly semanticCacheClient: ClientProxy,
    @Optional() private readonly authContext?: AuthenticationContext,
  ) {}

  async forwardSemanticCacheRequest<TBody = undefined>(
    req: Request,
    res: Response,
    pattern: string,
    options?: { body?: TBody; statusCode?: number },
  ): Promise<void> {
    const user =
      this.authContext?.user ??
      (await this.authProxyService.resolveCurrentUser(req.headers.cookie));
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const identityHeaders = this.authProxyService.buildDownstreamIdentityHeaders({
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId: 'gateway-semantic-cache-proxy',
    });

    const payload: SemanticCacheTcpRequestDto<TBody> = {
      headers: identityHeaders,
      ...(options?.body !== undefined ? { body: options.body } : {}),
    };

    try {
      const result = await firstValueFrom(this.semanticCacheClient.send<unknown>(pattern, payload));
      res.status(options?.statusCode ?? HttpStatus.OK).json(result);
    } catch (error) {
      throw this.mapRpcError(error, pattern);
    }
  }

  private mapRpcError(error: unknown, pattern: string): HttpException {
    const rpcError = extractRpcErrorPayload(error);
    if (rpcError?.statusCode) {
      return new HttpException(rpcError, rpcError.statusCode);
    }

    this.logger.error(
      JSON.stringify({
        event: 'gateway.semantic_cache_proxy.network_error',
        pattern,
        error: error instanceof Error ? error.message : 'Unknown TCP error',
      }),
    );
    return new BadGatewayException('Semantic Cache service unavailable');
  }
}
