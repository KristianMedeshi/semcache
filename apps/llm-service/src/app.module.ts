import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { SharedConfigModule } from '@semcache/shared-config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import './auth/llm-auth-types';
import { InternalIdentityAuth } from './auth/internal-identity.provider';
import { HttpToRpcExceptionFilter } from './common/http-to-rpc-exception.filter';
import { llmEnvSchema } from './config/llm.env';
import { LlmModule } from './llm/llm.module';

@Module({
  imports: [
    SharedConfigModule.forRoot(llmEnvSchema),
    AuthenticationModule.forRoot({}),
    AuthorizationModule.forRoot(),
    LlmModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    InternalIdentityAuth,
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
