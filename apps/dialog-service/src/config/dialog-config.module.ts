import { Global, Module } from '@nestjs/common';
import { SharedConfigModule, dialogEnvSchema } from '@semcache/shared-config';
import { DialogConfigService } from './dialog-config.service';

@Global()
@Module({
  imports: [SharedConfigModule.forRoot(dialogEnvSchema)],
  providers: [DialogConfigService],
  exports: [SharedConfigModule, DialogConfigService],
})
export class DialogConfigModule {}
