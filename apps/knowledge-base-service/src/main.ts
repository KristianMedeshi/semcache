import { bootstrapTcpMicroservice } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { AppModule } from './app.module';
import { knowledgeBaseEnvSchema } from './config/knowledge-base.env';

void bootstrapTcpMicroservice(
  AppModule,
  knowledgeBaseEnvSchema,
  ServiceName.KNOWLEDGE_BASE_SERVICE,
);
