import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { verifySignedInternalHeaders } from '@semcache/shared-config';
import type { AuthenticatedUser } from '@semcache/shared-types';
import type { Request } from 'express';
import { DialogConfigService } from '../config/dialog-config.service';

export interface InternalAuthenticatedRequest extends Request {
  internalUser?: AuthenticatedUser;
}

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(private readonly config: DialogConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<InternalAuthenticatedRequest>();
    const verified = verifySignedInternalHeaders(
      request.headers,
      this.config.internalServiceSecret,
    );

    if (!verified) {
      throw new UnauthorizedException('Invalid or missing internal identity signature');
    }

    request.internalUser = verified;
    return true;
  }
}

export const CurrentInternalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<InternalAuthenticatedRequest>();
    if (!request.internalUser) {
      throw new UnauthorizedException('Internal user context not resolved');
    }
    return request.internalUser;
  },
);
