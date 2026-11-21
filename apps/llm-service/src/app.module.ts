import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpToRpcExceptionFilter } from './common/http-to-rpc-exception.filter';
import { LlmConfigModule } from './config/llm-config.module';
import { LlmModule } from './llm/llm.module';

@Module({
  imports: [
    LlmConfigModule,
    AuthenticationModule.forRoot({}),
    AuthorizationModule.forRoot(),
    LlmModule,
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
