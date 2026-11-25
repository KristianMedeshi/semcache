import { Module } from '@nestjs/common';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { SharedConfigModule, createRpcGlobalProviders } from '@semcache/shared-config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import './auth/llm-auth-types';
import { InternalIdentityAuth } from './auth/internal-identity.provider';
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
  providers: [AppService, InternalIdentityAuth, ...createRpcGlobalProviders()],
})
export class AppModule {}
