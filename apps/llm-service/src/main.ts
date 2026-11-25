import { bootstrapTcpMicroservice } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { AppModule } from './app.module';
import { llmEnvSchema } from './config/llm.env';

void bootstrapTcpMicroservice(AppModule, llmEnvSchema, ServiceName.LLM_SERVICE);
