import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { AuthenticationContext } from '@nestjs/authentication';
import { ClientProxy } from '@nestjs/microservices';
import type { KnowledgeBaseTcpRequestDto } from '@semcache/shared-dtos';
import { KnowledgeDocumentStatus, SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import type { Request, Response } from 'express';
import { AuthProxyService } from '../auth/auth-proxy.service';
import { BaseTcpProxyService } from '../common/base-tcp-proxy.service';
import { MetricsService } from '../metrics/metrics.service';

export const KNOWLEDGE_BASE_SERVICE_CLIENT = Symbol('KNOWLEDGE_BASE_SERVICE_CLIENT');

@Injectable()
export class KnowledgeBaseProxyService extends BaseTcpProxyService {
  protected readonly logger = new Logger(KnowledgeBaseProxyService.name);

  constructor(
    authProxyService: AuthProxyService,
    @Inject(KNOWLEDGE_BASE_SERVICE_CLIENT) private readonly kbClient: ClientProxy,
    @Optional() authContext?: AuthenticationContext,
    @Optional() private readonly metricsService?: MetricsService,
  ) {
    super(authProxyService, authContext);
  }

  async forwardKnowledgeBaseRequest<TBody = undefined>(
    req: Request,
    res: Response,
    pattern: string,
    options?: { documentId?: string; body?: TBody; statusCode?: number },
  ): Promise<void> {
    const identityHeaders = await this.buildIdentityHeaders(req, 'gateway-knowledge-base-proxy');

    const payload: KnowledgeBaseTcpRequestDto<TBody> = {
      headers: identityHeaders,
      ...(options?.documentId !== undefined ? { documentId: options.documentId } : {}),
      ...(options?.body !== undefined ? { body: options.body } : {}),
    };

    const result = await this.sendTcp<unknown>(
      this.kbClient,
      pattern,
      payload,
      'gateway.knowledge_base_proxy.network_error',
      'Knowledge Base service unavailable',
    );

    if (this.metricsService) {
      const isReadyDocument =
        typeof result === 'object' &&
        result !== null &&
        'status' in result &&
        (result as { status?: unknown }).status === KnowledgeDocumentStatus.READY;

      if (pattern === SERVICE_TCP_PATTERNS.KB_DOCUMENTS_UPLOAD && isReadyDocument) {
        this.metricsService.recordKbInvalidation('unlinked');
      } else if (pattern === SERVICE_TCP_PATTERNS.KB_DOCUMENTS_REPROCESS) {
        this.metricsService.recordKbInvalidation('sources');
        if (isReadyDocument) {
          this.metricsService.recordKbInvalidation('unlinked');
        }
      } else if (pattern === SERVICE_TCP_PATTERNS.KB_DOCUMENTS_DELETE) {
        this.metricsService.recordKbInvalidation('sources');
      }
    }

    res.status(options?.statusCode ?? HttpStatus.OK).json(result);
  }
}
