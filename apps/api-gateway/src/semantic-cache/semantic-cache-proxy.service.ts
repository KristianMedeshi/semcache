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
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import type { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { AuthProxyService } from '../auth/auth-proxy.service';
import { MetricsService } from '../metrics/metrics.service';

export const SEMANTIC_CACHE_SERVICE_CLIENT = Symbol('SEMANTIC_CACHE_SERVICE_CLIENT');

@Injectable()
export class SemanticCacheProxyService {
  private readonly logger = new Logger(SemanticCacheProxyService.name);

  constructor(
    private readonly authProxyService: AuthProxyService,
    @Inject(SEMANTIC_CACHE_SERVICE_CLIENT) private readonly semanticCacheClient: ClientProxy,
    @Optional() private readonly authContext?: AuthenticationContext,
    @Optional() private readonly metricsService?: MetricsService,
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
      if (this.metricsService) {
        if (pattern === SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_BY_SOURCES) {
          this.metricsService.recordKbInvalidation('sources');
        } else if (pattern === SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_BY_CATEGORY) {
          this.metricsService.recordKbInvalidation('category');
        } else if (pattern === SERVICE_TCP_PATTERNS.CACHE_CLEAR_ALL) {
          this.metricsService.recordKbInvalidation('all');
        }
      }
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
