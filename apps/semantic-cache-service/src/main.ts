import { bootstrapTcpMicroservice } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { AppModule } from './app.module';
import { semanticCacheEnvSchema } from './config/semantic-cache.env';

void bootstrapTcpMicroservice(
  AppModule,
  semanticCacheEnvSchema,
  ServiceName.SEMANTIC_CACHE_SERVICE,
);
