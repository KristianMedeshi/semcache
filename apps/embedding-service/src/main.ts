import { bootstrapTcpMicroservice } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { AppModule } from './app.module';
import { embeddingEnvSchema } from './config/embedding.env';

void bootstrapTcpMicroservice(AppModule, embeddingEnvSchema, ServiceName.EMBEDDING_SERVICE);
