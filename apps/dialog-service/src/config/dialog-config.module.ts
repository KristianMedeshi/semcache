import { Global, Module } from '@nestjs/common';
import { SharedConfigModule } from '@semcache/shared-config';
import { DialogConfigService } from './dialog-config.service';
import { dialogEnvSchema } from './dialog.env';

@Global()
@Module({
  imports: [SharedConfigModule.forRoot(dialogEnvSchema)],
  providers: [DialogConfigService],
  exports: [SharedConfigModule, DialogConfigService],
})
export class DialogConfigModule {}
