import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { SharedConfigModule } from '@semcache/shared-config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import './auth/knowledge-base-auth-types';
import { HttpToRpcExceptionFilter } from './common/http-to-rpc-exception.filter';
import { knowledgeBaseEnvSchema } from './config/knowledge-base.env';
import { DatabaseModule } from './db/database.module';
import { KnowledgeBaseModule } from './knowledge-base/knowledge-base.module';

@Module({
  imports: [
    SharedConfigModule.forRoot(knowledgeBaseEnvSchema),
    DatabaseModule,
    AuthenticationModule.forRoot({}),
    AuthorizationModule.forRoot(),
    KnowledgeBaseModule,
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
