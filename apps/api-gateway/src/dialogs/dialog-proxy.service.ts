import { BadGatewayException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthProxyService } from '../auth/auth-proxy.service';
import { GatewayConfigService } from '../config/gateway-config.service';

@Injectable()
export class DialogProxyService {
  private readonly logger = new Logger(DialogProxyService.name);

  constructor(
    private readonly config: GatewayConfigService,
    private readonly authProxyService: AuthProxyService,
  ) {}

  async forwardDialogRequest(
    req: Request,
    res: Response,
    targetPath: string,
    body?: unknown,
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

    const headers: Record<string, string> = {
      ...identityHeaders,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    };

    let upstream: globalThis.Response;
    try {
      upstream = await fetch(`${this.config.dialogServiceUrl}${targetPath}`, {
        method: req.method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'gateway.dialog_proxy.network_error',
          path: targetPath,
          error: error instanceof Error ? error.message : 'Unknown fetch error',
        }),
      );
      throw new BadGatewayException('Dialog service unavailable');
    }

    const rawBody = await upstream.text();
    res.status(upstream.status);
    if (!rawBody) {
      res.end();
      return;
    }

    const contentType = upstream.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      res.json(JSON.parse(rawBody) as unknown);
      return;
    }
    res.send(rawBody);
  }
}
