import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, normalizeIp } from '@nestjs/throttler';

@Injectable()
export class RpcThrottlerGuard extends ThrottlerGuard {
  protected override getRequestResponse(context: ExecutionContext): {
    req: Record<string, unknown>;
    res: Record<string, unknown>;
  } {
    if (context.getType() === 'rpc') {
      const data = context.switchToRpc().getData<unknown>();
      return {
        req: typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {},
        res: {},
      };
    }
    return super.getRequestResponse(context);
  }

  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const ip = typeof req.ip === 'string' && req.ip.length > 0 ? normalizeIp(req.ip) : '127.0.0.1';
    return normalizeIp(ip, this.ipv6SubnetPrefix);
  }
}
