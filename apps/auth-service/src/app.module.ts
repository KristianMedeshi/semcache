import { type ExecutionContext, Injectable, Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { ThrottlerGuard, ThrottlerModule, minutes, normalizeIp } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import './auth/auth-types';
import { accountEmail } from './auth/account-email';
import { AuthModule } from './auth/auth.module';
import { HttpToRpcExceptionFilter } from './common/http-to-rpc-exception.filter';
import { AuthConfigModule } from './config/auth-config.module';
import { AuthConfigService } from './config/auth-config.service';
import { DatabaseModule } from './db/database.module';
import { UsersModule } from './users/users.module';

@Injectable()
class RpcThrottlerGuard extends ThrottlerGuard {
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
    const ip = typeof req.ip === 'string' && req.ip.length > 0 ? req.ip : '127.0.0.1';
    return normalizeIp(ip, this.ipv6SubnetPrefix);
  }
}

@Module({
  imports: [
    AuthConfigModule,
    DatabaseModule,
    ThrottlerModule.forRootAsync({
      inject: [AuthConfigService],
      useFactory: (config: AuthConfigService) => [
        {
          name: 'default',
          ttl: minutes(1),
          limit: 100,
        },
        {
          name: 'account',
          ttl: config.loginRateLimitWindowMs,
          limit: config.loginRateLimitMaxAttempts,
          skipIf: (context) => {
            const req =
              context.getType() === 'rpc'
                ? context.switchToRpc().getData<{ body?: { email?: unknown }; email?: unknown }>()
                : context.switchToHttp().getRequest<{ body?: { email?: unknown } }>();
            return !accountEmail(req);
          },
          getTracker: (req: Record<string, unknown>) => {
            const ip =
              typeof req.ip === 'string' && req.ip.length > 0 ? normalizeIp(req.ip) : '127.0.0.1';
            return `${accountEmail(req as { body?: { email?: unknown }; email?: unknown })}|${ip}`;
          },
        },
      ],
    }),
    AuthenticationModule.forRootAsync({
      inject: [AuthConfigService],
      useFactory: (config: AuthConfigService) => ({
        session: {
          cookieName: config.sessionCookieName,
          absoluteTtl: config.sessionTtlMs,
          idleTtl: config.sessionIdleTimeoutMs,
          touchInterval: Math.min(60_000, Math.max(0, Math.floor(config.sessionIdleTimeoutMs / 2))),
          trustedOrigins: config.corsOrigin,
          cookie: {
            secure: config.secureCookies,
            sameSite: 'lax',
            path: '/',
          },
          metadata: (request) => ({
            userAgent: request.headers['user-agent'],
          }),
        },
      }),
    }),
    AuthorizationModule.forRoot(),
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpToRpcExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: RpcThrottlerGuard,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
      }),
    },
  ],
})
export class AppModule {}
