import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { extractRpcErrorPayload } from '@semcache/shared-config';
import type { DialogTcpRequestDto } from '@semcache/shared-dtos';
import type { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { AuthProxyService } from '../auth/auth-proxy.service';

export const DIALOG_SERVICE_CLIENT = Symbol('DIALOG_SERVICE_CLIENT');

@Injectable()
export class DialogProxyService {
  private readonly logger = new Logger(DialogProxyService.name);

  constructor(
    private readonly authProxyService: AuthProxyService,
    @Inject(DIALOG_SERVICE_CLIENT) private readonly dialogClient: ClientProxy,
  ) {}

  async forwardDialogRequest<TBody = undefined>(
    req: Request,
    res: Response,
    pattern: string,
    options?: { dialogId?: string; body?: TBody; statusCode?: number },
  ): Promise<void> {
    const user = await this.authProxyService.resolveCurrentUser(req.headers.cookie);
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const identityHeaders = this.authProxyService.buildDownstreamIdentityHeaders({
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId: 'gateway-dialog-proxy',
    });

    const payload: DialogTcpRequestDto<TBody> = {
      headers: identityHeaders,
      ...(options?.dialogId !== undefined ? { dialogId: options.dialogId } : {}),
      ...(options?.body !== undefined ? { body: options.body } : {}),
    };

    let result: unknown;
    try {
      result = await firstValueFrom(this.dialogClient.send<unknown>(pattern, payload));
    } catch (error) {
      const rpcError = extractRpcErrorPayload(error);
      if (rpcError?.statusCode) {
        throw new HttpException(rpcError, rpcError.statusCode);
      }

      this.logger.error(
        JSON.stringify({
          event: 'gateway.dialog_proxy.network_error',
          pattern,
          error: error instanceof Error ? error.message : 'Unknown TCP error',
        }),
      );
      throw new BadGatewayException('Dialog service unavailable');
    }

    res.status(options?.statusCode ?? HttpStatus.OK).json(result);
  }
}
