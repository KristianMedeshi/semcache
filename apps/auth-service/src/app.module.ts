import { Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { ThrottlerGuard, ThrottlerModule, minutes, normalizeIp } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import './auth/auth-types';
import { accountEmail } from './auth/account-email';
import { AuthModule } from './auth/auth.module';
import { AuthConfigModule } from './config/auth-config.module';
import { AuthConfigService } from './config/auth-config.service';
import { DatabaseModule } from './db/database.module';
import { UsersModule } from './users/users.module';

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
          skipIf: (context) => !accountEmail(context.switchToHttp().getRequest()),
          getTracker: (req: Record<string, unknown>) => {
            const ip = typeof req.ip === 'string' ? normalizeIp(req.ip) : 'unknown';
            return `${accountEmail(req as { body?: { email?: unknown } })}|${ip}`;
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
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
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
