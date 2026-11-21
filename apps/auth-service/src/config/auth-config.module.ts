import { Global, Module } from '@nestjs/common';
import { SharedConfigModule, authEnvSchema } from '@semcache/shared-config';
import { AuthConfigService } from './auth-config.service';

@Global()
@Module({
  imports: [SharedConfigModule.forRoot(authEnvSchema)],
  providers: [AuthConfigService],
  exports: [SharedConfigModule, AuthConfigService],
})
export class AuthConfigModule {}
