import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { SharedConfigModule } from '@semcache/shared-config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import './auth/semantic-cache-auth-types';
import { HttpToRpcExceptionFilter } from './common/http-to-rpc-exception.filter';
import { semanticCacheEnvSchema } from './config/semantic-cache.env';
import { DatabaseModule } from './db/database.module';
import { SemanticCacheModule } from './semantic-cache/semantic-cache.module';

@Module({
  imports: [
    SharedConfigModule.forRoot(semanticCacheEnvSchema),
    DatabaseModule,
    AuthenticationModule.forRoot({}),
    AuthorizationModule.forRoot(),
    SemanticCacheModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpToRpcExceptionFilter,
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
