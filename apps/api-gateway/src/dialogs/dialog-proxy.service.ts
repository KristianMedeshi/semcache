import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { AuthenticationContext } from '@nestjs/authentication';
import { ClientProxy } from '@nestjs/microservices';
import type { DialogMessageStreamEventDto, DialogTcpRequestDto } from '@semcache/shared-dtos';
import { type Observable, Subject, catchError, takeUntil, tap, throwError } from 'rxjs';
import { AuthProxyService } from '../auth/auth-proxy.service';
import { BaseTcpProxyService } from '../common/base-tcp-proxy.service';
import { MetricsService } from '../metrics/metrics.service';

export const DIALOG_SERVICE_CLIENT = Symbol('DIALOG_SERVICE_CLIENT');

export interface DialogProxyResult<T = unknown> {
  data: T;
  cacheHeaders?: {
    status?: string;
    mode?: string;
  };
}

@Injectable()
export class DialogProxyService extends BaseTcpProxyService implements BeforeApplicationShutdown {
  protected readonly logger = new Logger(DialogProxyService.name);
  private readonly shutdown$ = new Subject<void>();

  constructor(
    authProxyService: AuthProxyService,
    @Inject(DIALOG_SERVICE_CLIENT) private readonly dialogClient: ClientProxy,
    @Optional() authContext?: AuthenticationContext,
    @Optional() private readonly metricsService?: MetricsService,
  ) {
    super(authProxyService, authContext);
  }

  beforeApplicationShutdown(): void {
    this.shutdown$.next();
    this.shutdown$.complete();
  }

  async forwardDialogRequest<TResult = unknown, TBody = undefined>(
    cookieHeader: string | undefined,
    pattern: string,
    options?: { dialogId?: string; messageId?: string; body?: TBody },
  ): Promise<DialogProxyResult<TResult>> {
    const payload = await this.buildAuthenticatedDialogPayload(cookieHeader, options);
    const startedAt = performance.now();

    const result = await this.sendTcp<TResult>(
      this.dialogClient,
      pattern,
      payload,
      'gateway.dialog_proxy.network_error',
      'Dialog service unavailable',
    );

    let cacheHeaders: DialogProxyResult['cacheHeaders'];
    if (result && typeof result === 'object' && 'cache' in result && result.cache) {
      const cache = result.cache as { status?: string; mode?: string; category?: string };
      if (cache.status || cache.mode) {
        cacheHeaders = {
          ...(cache.status ? { status: cache.status } : {}),
          ...(cache.mode ? { mode: cache.mode } : {}),
        };
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

    return {
      data: result,
      ...(cacheHeaders ? { cacheHeaders } : {}),
    };
  }

  async createDialogStream<TBody = undefined>(
    cookieHeader: string | undefined,
    pattern: string,
    options?: { dialogId?: string; messageId?: string; body?: TBody },
  ): Promise<Observable<DialogMessageStreamEventDto>> {
    const payload = await this.buildAuthenticatedDialogPayload(cookieHeader, options);
    const startedAt = performance.now();

    return this.dialogClient.send<DialogMessageStreamEventDto>(pattern, payload).pipe(
      takeUntil(this.shutdown$),
      tap((event) => {
        if (event.type === 'done' && event.cache?.status && this.metricsService) {
          this.metricsService.recordCacheTurn({
            status: event.cache.status,
            mode: event.cache.mode ?? 'unknown',
            category: event.cache.category ?? 'general',
            durationSeconds: (performance.now() - startedAt) / 1000,
            usage: event.assistantMessage?.usage,
          });
        }
      }),
      catchError((error: unknown) =>
        throwError(() =>
          this.mapRpcError(
            error,
            pattern,
            'gateway.dialog_proxy.network_error',
            'Dialog service unavailable',
          ),
        ),
      ),
    );
  }

  private async buildAuthenticatedDialogPayload<TBody>(
    cookieHeader: string | undefined,
    options?: { dialogId?: string; messageId?: string; body?: TBody },
  ): Promise<DialogTcpRequestDto<TBody>> {
    const identityHeaders = await this.buildIdentityHeaders(cookieHeader, 'gateway-dialog-proxy');

    return {
      headers: identityHeaders,
      ...(options?.dialogId !== undefined ? { dialogId: options.dialogId } : {}),
      ...(options?.messageId !== undefined ? { messageId: options.messageId } : {}),
      ...(options?.body !== undefined ? { body: options.body } : {}),
    };
  }
}
