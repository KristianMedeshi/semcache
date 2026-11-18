import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import type { UserResponseDto } from '@semcache/shared-dtos';
import type { AuthenticatedUser } from '@semcache/shared-types';
import type { Request, Response } from 'express';
import { GatewayConfigService } from '../config/gateway-config.service';
import { createSignedInternalHeaders, stripForgedInternalHeaders } from './internal-identity.util';

const FORWARDED_HEADERS = [
  'cookie',
  'origin',
  'referer',
  'sec-fetch-site',
  'user-agent',
  'x-forwarded-for',
] as const;

@Injectable()
export class AuthProxyService {
  private readonly logger = new Logger(AuthProxyService.name);

  constructor(private readonly config: GatewayConfigService) {}

  async forwardRequest(
    req: Request,
    res: Response,
    targetPath: string,
    body?: unknown,
  ): Promise<void> {
    const sanitizedIncoming = stripForgedInternalHeaders(req.headers);
    const forwardHeaders: Record<string, string> = {};

    for (const headerName of FORWARDED_HEADERS) {
      const value = sanitizedIncoming[headerName];
      if (typeof value === 'string' && value.length > 0) {
        forwardHeaders[headerName] = value;
      } else if (Array.isArray(value) && value.length > 0) {
        forwardHeaders[headerName] = value.join('; ');
      }
    }

    if (body !== undefined) {
      forwardHeaders['content-type'] = 'application/json';
    }

    let upstream: globalThis.Response;
    try {
      upstream = await fetch(`${this.config.authServiceUrl}${targetPath}`, {
        method: req.method,
        headers: forwardHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'gateway.auth_proxy.network_error',
          path: targetPath,
          error: error instanceof Error ? error.message : 'Unknown fetch error',
        }),
      );
      throw new BadGatewayException('Authentication service unavailable');
    }

    const setCookies = upstream.headers.getSetCookie();
    if (setCookies.length > 0) {
      res.setHeader('set-cookie', setCookies);
    }

    const contentType = upstream.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const payload: unknown = await upstream.json();
      res.status(upstream.status).json(payload);
      return;
    }

    const text = await upstream.text();
    res.status(upstream.status).send(text);
  }

  async resolveCurrentUser(cookieHeader?: string): Promise<UserResponseDto | null> {
    if (!cookieHeader) {
      return null;
    }

    try {
      const response = await fetch(`${this.config.authServiceUrl}/auth/me`, {
        method: 'GET',
        headers: { cookie: cookieHeader },
      });
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as UserResponseDto;
    } catch {
      return null;
    }
  }

  buildDownstreamIdentityHeaders(user: AuthenticatedUser): Record<string, string> {
    return createSignedInternalHeaders(user, this.config.internalServiceSecret);
  }
}
