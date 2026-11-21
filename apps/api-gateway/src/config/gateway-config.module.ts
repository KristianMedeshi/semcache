import { Global, Module } from '@nestjs/common';
import { SharedConfigModule } from '@semcache/shared-config';
import { GatewayConfigService } from './gateway-config.service';
import { gatewayEnvSchema } from './gateway.env';

@Global()
@Module({
  imports: [SharedConfigModule.forRoot(gatewayEnvSchema)],
  providers: [GatewayConfigService],
  exports: [SharedConfigModule, GatewayConfigService],
})
export class GatewayConfigModule {}
