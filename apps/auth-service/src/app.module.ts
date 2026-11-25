import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { ThrottlerModule, minutes, normalizeIp } from '@nestjs/throttler';
import {
  ConfigService,
  SharedConfigModule,
  createRpcGlobalProviders,
  durationToMs,
  isTestSecurityBypassEnabled,
} from '@semcache/shared-config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import './auth/auth-types';
import { accountEmail } from './auth/account-email';
import { AuthModule } from './auth/auth.module';
import { RpcThrottlerGuard } from './auth/rpc-throttler.guard';
import { type AuthEnv, authEnvSchema } from './config/auth.env';
import { DatabaseModule } from './db/database.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    SharedConfigModule.forRoot(authEnvSchema),
    DatabaseModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AuthEnv, true>) => {
        const skipInTest = isTestSecurityBypassEnabled(
          config.getOrThrow('NODE_ENV'),
          config.get('TEST_BYPASS_SECURITY'),
        );
        return [
          {
            name: 'default',
            ttl: minutes(1),
            limit: 100,
            skipIf: () => skipInTest,
          },
          {
            name: 'account',
            ttl: config.getOrThrow('LOGIN_RATE_LIMIT_WINDOW_MS'),
            limit: config.getOrThrow('LOGIN_RATE_LIMIT_MAX_ATTEMPTS'),
            skipIf: (context) => {
              if (skipInTest) {
                return true;
              }
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
        ];
      },
    }),
    AuthenticationModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AuthEnv, true>) => {
        const sessionIdleTimeout = config.getOrThrow('SESSION_IDLE_TIMEOUT');
        const idleTtlMs = durationToMs(sessionIdleTimeout);
        const secureCookieOverride = config.get('SECURE_COOKIES') ?? '';
        const secureCookies =
          secureCookieOverride === 'true'
            ? true
            : secureCookieOverride === 'false'
              ? false
              : config.getOrThrow('NODE_ENV') === 'production';

        return {
          session: {
            cookieName: config.getOrThrow('SESSION_COOKIE_NAME'),
            absoluteTtl: config.getOrThrow('SESSION_TTL'),
            idleTtl: sessionIdleTimeout,
            touchInterval: idleTtlMs > 0 ? Math.min(60_000, Math.floor(idleTtlMs / 2)) : 0,
            trustedOrigins: config.getOrThrow('CORS_ORIGIN'),
            cookie: {
              secure: secureCookies,
              sameSite: 'lax',
              path: '/',
            },
            metadata: (request) => ({
              userAgent: request.headers['user-agent'],
            }),
          },
        };
      },
    }),
    AuthorizationModule.forRoot(),
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ...createRpcGlobalProviders(),
    RpcThrottlerGuard,
    {
      provide: APP_GUARD,
      useExisting: RpcThrottlerGuard,
    },
  ],
})
export class AppModule {}
