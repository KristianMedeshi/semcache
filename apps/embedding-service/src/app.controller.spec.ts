import { describeServiceHealthController } from '@semcache/shared-config/testing';
import { ServiceName } from '@semcache/shared-types';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describeServiceHealthController(AppController, AppService, ServiceName.EMBEDDING_SERVICE);
