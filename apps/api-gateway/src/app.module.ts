import { type MiddlewareConsumer, Module, type NestModule, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GatewayAuthModule } from './auth/gateway-auth.module';
import { StripInternalHeadersMiddleware } from './auth/strip-internal-headers.middleware';
import { GatewayConfigModule } from './config/gateway-config.module';

@Module({
  imports: [GatewayConfigModule, GatewayAuthModule],
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
