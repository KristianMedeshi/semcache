import { type ExecutionContext, Injectable, createParamDecorator } from '@nestjs/common';
import {
  AuthenticationRegistry,
  type AuthenticationResult,
  SessionCookieProvider,
  type SessionRecord,
} from '@nestjs/authentication';
import type { AuthTcpRequestDto, UserResponseDto } from '@semcache/shared-dtos';
import { UsersRepository } from '../users/users.repository';

export interface RpcRequestContextData {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  ip?: string;
}

export function extractRpcRequestContext(context: ExecutionContext): RpcRequestContextData {
  const data = context.switchToRpc().getData<AuthTcpRequestDto<unknown> | undefined>();
  const normalizedHeaders: Record<string, string | string[] | undefined> = {};

  if (data?.headers && typeof data.headers === 'object') {
    for (const [key, value] of Object.entries(data.headers)) {
      normalizedHeaders[key.toLowerCase()] = value;
    }
  }

  return {
    headers: normalizedHeaders,
    method: typeof data?.method === 'string' ? data.method : undefined,
    ip: typeof data?.ip === 'string' ? data.ip : undefined,
  };
}

export const RpcRequestContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RpcRequestContextData => {
    if (context.getType() === 'rpc') {
      return extractRpcRequestContext(context);
    }

    const req = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
      method?: string;
      ip?: string;
    }>();
    return {
      headers: req.headers ?? {},
      method: req.method,
      ip: req.ip,
    };
  },
);

@Injectable()
export class SessionAuth extends SessionCookieProvider<UserResponseDto> {
  constructor(
    private readonly usersRepository: UsersRepository,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  override async authenticate(
    context: ExecutionContext,
  ): Promise<AuthenticationResult<UserResponseDto, SessionRecord> | null> {
    if (context.getType() !== 'rpc') {
      return super.authenticate(context);
    }

    const reqContext = extractRpcRequestContext(context);
    const session = await this.sessions.validate(this.sessions.tokenFrom(reqContext));
    if (!session) {
      return null;
    }

    const user = await this.validate(session);
    if (user === null || user === undefined) {
      await this.sessions.discard(session.id);
      return null;
    }

    const { extra: _extra, ...stored } = session;
    return { user, session: stored, mfa: session.mfa };
  }

  async validate(session: SessionRecord): Promise<UserResponseDto | null> {
    return session.extra?.user ?? (await this.usersRepository.findById(session.userId));
  }
}
