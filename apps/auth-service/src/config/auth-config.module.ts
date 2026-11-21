import { Global, Module } from '@nestjs/common';
import { SharedConfigModule } from '@semcache/shared-config';
import { AuthConfigService } from './auth-config.service';
import { authEnvSchema } from './auth.env';

@Global()
@Module({
  imports: [SharedConfigModule.forRoot(authEnvSchema)],
  providers: [AuthConfigService],
  exports: [SharedConfigModule, AuthConfigService],
})
export class AuthConfigModule {}
