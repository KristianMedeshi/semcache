import { type MiddlewareConsumer, Module, type NestModule, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { SharedConfigModule } from '@semcache/shared-config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import './auth/gateway-auth-types';
import { GatewayAuthModule } from './auth/gateway-auth.module';
import { StripInternalHeadersMiddleware } from './auth/strip-internal-headers.middleware';
import { gatewayEnvSchema } from './config/gateway.env';
import { GatewayDialogsModule } from './dialogs/gateway-dialogs.module';
import { GatewayKnowledgeBaseModule } from './knowledge-base/gateway-knowledge-base.module';
import { GatewaySemanticCacheModule } from './semantic-cache/gateway-semantic-cache.module';

@Module({
  imports: [
    SharedConfigModule.forRoot(gatewayEnvSchema),
    AuthenticationModule.forRoot({}),
    AuthorizationModule.forRoot(),
    GatewayAuthModule,
    GatewayDialogsModule,
    GatewayKnowledgeBaseModule,
    GatewaySemanticCacheModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(StripInternalHeadersMiddleware).forRoutes('*');
  }
}
