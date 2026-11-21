import { Global, Module } from '@nestjs/common';
import { SharedConfigModule, gatewayEnvSchema } from '@semcache/shared-config';
import { GatewayConfigService } from './gateway-config.service';

@Global()
@Module({
  imports: [SharedConfigModule.forRoot(gatewayEnvSchema)],
  providers: [GatewayConfigService],
  exports: [SharedConfigModule, GatewayConfigService],
})
export class GatewayConfigModule {}
