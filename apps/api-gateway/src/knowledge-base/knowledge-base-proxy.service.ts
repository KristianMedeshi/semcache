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
import type { KnowledgeBaseTcpRequestDto } from '@semcache/shared-dtos';
import type { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { AuthProxyService } from '../auth/auth-proxy.service';

export const KNOWLEDGE_BASE_SERVICE_CLIENT = Symbol('KNOWLEDGE_BASE_SERVICE_CLIENT');

@Injectable()
export class KnowledgeBaseProxyService {
  private readonly logger = new Logger(KnowledgeBaseProxyService.name);

  constructor(
    private readonly authProxyService: AuthProxyService,
    @Inject(KNOWLEDGE_BASE_SERVICE_CLIENT) private readonly kbClient: ClientProxy,
    @Optional() private readonly authContext?: AuthenticationContext,
  ) {}

  async forwardKnowledgeBaseRequest<TBody = undefined>(
    req: Request,
    res: Response,
    pattern: string,
    options?: { documentId?: string; body?: TBody; statusCode?: number },
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
      sessionId: 'gateway-knowledge-base-proxy',
    });

    const payload: KnowledgeBaseTcpRequestDto<TBody> = {
      headers: identityHeaders,
      ...(options?.documentId !== undefined ? { documentId: options.documentId } : {}),
      ...(options?.body !== undefined ? { body: options.body } : {}),
    };

    let result: unknown;
    try {
      result = await firstValueFrom(this.kbClient.send<unknown>(pattern, payload));
    } catch (error) {
      throw this.mapRpcError(error, pattern);
    }

    res.status(options?.statusCode ?? HttpStatus.OK).json(result);
  }

  private mapRpcError(error: unknown, pattern: string): HttpException {
    const rpcError = extractRpcErrorPayload(error);
    if (rpcError?.statusCode) {
      return new HttpException(rpcError, rpcError.statusCode);
    }

    this.logger.error(
      JSON.stringify({
        event: 'gateway.knowledge_base_proxy.network_error',
        pattern,
        error: error instanceof Error ? error.message : 'Unknown TCP error',
      }),
    );
    return new BadGatewayException('Knowledge Base service unavailable');
  }
}
