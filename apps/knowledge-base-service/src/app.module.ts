import { Module } from '@nestjs/common';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { SharedConfigModule, createRpcGlobalProviders } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import './auth/knowledge-base-auth-types';
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
  providers: [AppService, ...createRpcGlobalProviders(ServiceName.KNOWLEDGE_BASE_SERVICE)],
})
export class AppModule {}
