import { bootstrapTcpMicroservice } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { AppModule } from './app.module';
import { dialogEnvSchema } from './config/dialog.env';

void bootstrapTcpMicroservice(AppModule, dialogEnvSchema, ServiceName.DIALOG_SERVICE);
