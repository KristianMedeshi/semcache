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
import { extractRpcErrorPayload, formatRpcErrorMessage } from '@semcache/shared-config';
import type {
  DialogMessageStreamErrorEventDto,
  DialogMessageStreamEventDto,
  DialogTcpRequestDto,
} from '@semcache/shared-dtos';
import type { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { AuthProxyService } from '../auth/auth-proxy.service';
import { MetricsService } from '../metrics/metrics.service';

export const DIALOG_SERVICE_CLIENT = Symbol('DIALOG_SERVICE_CLIENT');

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

@Injectable()
export class DialogProxyService {
  private readonly logger = new Logger(DialogProxyService.name);

  constructor(
    private readonly authProxyService: AuthProxyService,
    @Inject(DIALOG_SERVICE_CLIENT) private readonly dialogClient: ClientProxy,
    @Optional() private readonly authContext?: AuthenticationContext,
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  async forwardDialogRequest<TBody = undefined>(
    req: Request,
    res: Response,
    pattern: string,
    options?: { dialogId?: string; messageId?: string; body?: TBody; statusCode?: number },
  ): Promise<void> {
    const payload = await this.buildAuthenticatedDialogPayload(req, options);
    const startedAt = performance.now();

    let result: unknown;
    try {
      result = await firstValueFrom(this.dialogClient.send<unknown>(pattern, payload));
    } catch (error) {
      throw this.mapRpcError(error, pattern);
    }

    if (result && typeof result === 'object' && 'cache' in result && result.cache) {
      const cache = result.cache as { status?: string; mode?: string; category?: string };
      if (cache.status && typeof res.setHeader === 'function') {
        res.setHeader('X-Cache-Status', cache.status);
      }
      if (cache.mode && typeof res.setHeader === 'function') {
        res.setHeader('X-Cache-Mode', cache.mode);
      }
      if (cache.status && this.metricsService) {
        const assistant =
          'assistantMessage' in result && result.assistantMessage
            ? (result.assistantMessage as {
                usage?: {
                  promptTokens?: number;
                  completionTokens?: number;
                  totalTokens?: number;
                } | null;
              })
            : undefined;
        this.metricsService.recordCacheTurn({
          status: cache.status,
          mode: cache.mode ?? 'unknown',
          category: cache.category ?? 'general',
          durationSeconds: (performance.now() - startedAt) / 1000,
          usage: assistant?.usage,
        });
      }
    }

    res.status(options?.statusCode ?? HttpStatus.OK).json(result);
  }

  async streamDialogRequest<TBody = undefined>(
    req: Request,
    res: Response,
    pattern: string,
    options?: { dialogId?: string; messageId?: string; body?: TBody },
  ): Promise<void> {
    const payload = await this.buildAuthenticatedDialogPayload(req, options);

    await new Promise<void>((resolve, reject) => {
      let headersSent = false;
      let settled = false;

      const subscription = this.dialogClient
        .send<DialogMessageStreamEventDto>(pattern, payload)
        .subscribe({
          next: (event) => {
            if (!headersSent) {
              headersSent = true;
              res.writeHead(HttpStatus.OK, SSE_HEADERS);
            }
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          },
          error: (error: unknown) => {
            const mapped = this.mapRpcError(error, pattern);
            if (!headersSent) {
              if (!settled) {
                settled = true;
                reject(mapped);
              }
              return;
            }

            const errorEvent: DialogMessageStreamErrorEventDto = {
              type: 'error',
              statusCode: mapped.getStatus(),
              message: formatRpcErrorMessage(
                { statusCode: mapped.getStatus(), message: mapped.message },
                'Streaming error',
              ),
            };
            res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
            res.end();
            if (!settled) {
              settled = true;
              resolve();
            }
          },
          complete: () => {
            if (!headersSent) {
              headersSent = true;
              res.writeHead(HttpStatus.OK, SSE_HEADERS);
            }
            res.end();
            if (!settled) {
              settled = true;
              resolve();
            }
          },
        });

      res.on('close', () => {
        subscription.unsubscribe();
        if (!settled) {
          settled = true;
          resolve();
        }
      });
    });
  }

  private async buildAuthenticatedDialogPayload<TBody>(
    req: Request,
    options?: { dialogId?: string; messageId?: string; body?: TBody },
  ): Promise<DialogTcpRequestDto<TBody>> {
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
      sessionId: 'gateway-dialog-proxy',
    });

    return {
      headers: identityHeaders,
      ...(options?.dialogId !== undefined ? { dialogId: options.dialogId } : {}),
      ...(options?.messageId !== undefined ? { messageId: options.messageId } : {}),
      ...(options?.body !== undefined ? { body: options.body } : {}),
    };
  }

  private mapRpcError(error: unknown, pattern: string): HttpException {
    const rpcError = extractRpcErrorPayload(error);
    if (rpcError?.statusCode) {
      return new HttpException(rpcError, rpcError.statusCode);
    }

    this.logger.error(
      JSON.stringify({
        event: 'gateway.dialog_proxy.network_error',
        pattern,
        error: error instanceof Error ? error.message : 'Unknown TCP error',
      }),
    );
    return new BadGatewayException('Dialog service unavailable');
  }
}
