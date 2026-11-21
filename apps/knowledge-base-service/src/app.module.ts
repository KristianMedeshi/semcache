import { Module } from '@nestjs/common';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { SharedConfigModule, knowledgeBaseEnvSchema } from '@semcache/shared-config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import './auth/knowledge-base-auth-types';
import { InternalIdentityAuth } from './auth/internal-identity.provider';
import { KnowledgeBasePolicy } from './policies/knowledge-base.policy';

@Module({
  imports: [
    SharedConfigModule.forRoot(knowledgeBaseEnvSchema),
    AuthenticationModule.forRoot({}),
    AuthorizationModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService, InternalIdentityAuth, KnowledgeBasePolicy],
  exports: [KnowledgeBasePolicy],
})
export class AppModule {}
