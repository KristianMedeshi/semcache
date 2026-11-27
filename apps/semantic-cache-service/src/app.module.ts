import { Module } from '@nestjs/common';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { SharedConfigModule, createRpcGlobalProviders } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import './auth/semantic-cache-auth-types';
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
  providers: [AppService, ...createRpcGlobalProviders(ServiceName.SEMANTIC_CACHE_SERVICE)],
})
export class AppModule {}
