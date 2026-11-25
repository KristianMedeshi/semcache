import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { AuthenticationContext } from '@nestjs/authentication';
import { ClientProxy } from '@nestjs/microservices';
import type { SemanticCacheTcpRequestDto } from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { AuthProxyService } from '../auth/auth-proxy.service';
import { BaseTcpProxyService } from '../common/base-tcp-proxy.service';
import { MetricsService } from '../metrics/metrics.service';

export const SEMANTIC_CACHE_SERVICE_CLIENT = Symbol('SEMANTIC_CACHE_SERVICE_CLIENT');

const CACHE_INVALIDATION_METRIC_KINDS: Partial<Record<string, 'sources' | 'category' | 'all'>> = {
  [SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_BY_SOURCES]: 'sources',
  [SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_BY_CATEGORY]: 'category',
  [SERVICE_TCP_PATTERNS.CACHE_CLEAR_ALL]: 'all',
};

@Injectable()
export class SemanticCacheProxyService extends BaseTcpProxyService {
  protected readonly logger = new Logger(SemanticCacheProxyService.name);

  constructor(
    authProxyService: AuthProxyService,
    @Inject(SEMANTIC_CACHE_SERVICE_CLIENT) private readonly semanticCacheClient: ClientProxy,
    @Optional() authContext?: AuthenticationContext,
    @Optional() private readonly metricsService?: MetricsService,
  ) {
    super(authProxyService, authContext);
  }

  async forwardSemanticCacheRequest<TResult = unknown, TBody = undefined>(
    cookieHeader: string | undefined,
    pattern: string,
    options?: { body?: TBody },
  ): Promise<TResult> {
    const identityHeaders = await this.buildIdentityHeaders(
      cookieHeader,
      'gateway-semantic-cache-proxy',
    );

    const payload: SemanticCacheTcpRequestDto<TBody> = {
      headers: identityHeaders,
      ...(options?.body !== undefined ? { body: options.body } : {}),
    };

    const result = await this.sendTcp<TResult>(
      this.semanticCacheClient,
      pattern,
      payload,
      'gateway.semantic_cache_proxy.network_error',
      'Semantic Cache service unavailable',
    );

    const invalidationKind = CACHE_INVALIDATION_METRIC_KINDS[pattern];
    if (this.metricsService && invalidationKind) {
      this.metricsService.recordKbInvalidation(invalidationKind);
    }

    return result;
  }
}
