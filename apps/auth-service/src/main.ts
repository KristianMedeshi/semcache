import { bootstrapTcpMicroservice } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { AppModule } from './app.module';
import { authEnvSchema } from './config/auth.env';

void bootstrapTcpMicroservice(AppModule, authEnvSchema, ServiceName.AUTH_SERVICE);
