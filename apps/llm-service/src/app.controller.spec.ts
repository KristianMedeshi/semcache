import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ServiceName } from '@semcache/shared-types';
import { describeServiceHealthController } from '@semcache/shared-config/testing';

describeServiceHealthController(AppController, AppService, ServiceName.LLM_SERVICE);
