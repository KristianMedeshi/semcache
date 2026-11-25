import { Controller } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { BaseTcpHealthController } from '@semcache/shared-config';
import { AppService } from './app.service';

@Public()
@Controller()
export class AppController extends BaseTcpHealthController {
  constructor(appService: AppService) {
    super(appService);
  }
}
