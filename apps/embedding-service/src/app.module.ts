import { Module } from '@nestjs/common';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { SharedConfigModule, createRpcGlobalProviders } from '@semcache/shared-config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import './auth/embedding-auth-types';
import { InternalIdentityAuth } from './auth/internal-identity.provider';
import { embeddingEnvSchema } from './config/embedding.env';
import { EmbeddingModule } from './embedding/embedding.module';

@Module({
  imports: [
    SharedConfigModule.forRoot(embeddingEnvSchema),
    AuthenticationModule.forRoot({}),
    AuthorizationModule.forRoot(),
    EmbeddingModule,
  ],
  controllers: [AppController],
  providers: [AppService, InternalIdentityAuth, ...createRpcGlobalProviders()],
})
export class AppModule {}
