import { Global, Module } from '@nestjs/common';
import { DialogConfigService } from './dialog-config.service';

@Global()
@Module({
  providers: [DialogConfigService],
  exports: [DialogConfigService],
})
export class DialogConfigModule {}
