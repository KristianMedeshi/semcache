import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { verifySignedInternalHeaders } from '@semcache/shared-config';
import type { AuthenticatedUser } from '@semcache/shared-types';
import { DialogConfigService } from '../config/dialog-config.service';

interface InternalRpcPayload {
  headers?: Record<string, string | string[] | undefined>;
  internalUser?: AuthenticatedUser;
}

interface InternalRpcContext {
  internalUser?: AuthenticatedUser;
}

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(private readonly config: DialogConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const rpc = context.switchToRpc();
    const data = rpc.getData<InternalRpcPayload | undefined>();
    const rpcContext = rpc.getContext<InternalRpcContext | undefined>();
    const verified = verifySignedInternalHeaders(
      data?.headers ?? {},
      this.config.internalServiceSecret,
    );

    if (!verified) {
      throw new UnauthorizedException('Invalid or missing internal identity signature');
    }

    if (rpcContext && typeof rpcContext === 'object') {
      rpcContext.internalUser = verified;
    }
    if (data && typeof data === 'object') {
      data.internalUser = verified;
    }
    return true;
  }
}

export const CurrentInternalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const rpc = ctx.switchToRpc();
    const rpcContext = rpc.getContext<InternalRpcContext | undefined>();
    const data = rpc.getData<InternalRpcPayload | undefined>();
    const user = rpcContext?.internalUser ?? data?.internalUser;
    if (!user) {
      throw new UnauthorizedException('Internal user context not resolved');
    }
    return user;
  },
);
