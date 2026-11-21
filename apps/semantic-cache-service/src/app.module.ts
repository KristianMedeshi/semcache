import { Module } from '@nestjs/common';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { SharedConfigModule } from '@semcache/shared-config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import './auth/semantic-cache-auth-types';
import { InternalIdentityAuth } from './auth/internal-identity.provider';
import { semanticCacheEnvSchema } from './config/semantic-cache.env';
import { SemanticCachePolicy } from './policies/semantic-cache.policy';

@Module({
  imports: [
    SharedConfigModule.forRoot(semanticCacheEnvSchema),
    AuthenticationModule.forRoot({}),
    AuthorizationModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService, InternalIdentityAuth, SemanticCachePolicy],
  exports: [SemanticCachePolicy],
})
export class AppModule {}
