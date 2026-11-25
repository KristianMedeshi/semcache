import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { createTcpClientProvider } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { GatewayAuthModule } from '../auth/gateway-auth.module';
import { MetricsModule } from '../metrics/metrics.module';
import { DIALOG_SERVICE_CLIENT, DialogProxyService } from './dialog-proxy.service';
import { GatewayDialogsController } from './gateway-dialogs.controller';

@Module({
  imports: [GatewayAuthModule, MetricsModule],
  controllers: [GatewayDialogsController],
  providers: [
    createTcpClientProvider(DIALOG_SERVICE_CLIENT, ServiceName.DIALOG_SERVICE),
    DialogProxyService,
  ],
})
export class GatewayDialogsModule implements OnModuleDestroy {
  constructor(@Inject(DIALOG_SERVICE_CLIENT) private readonly dialogClient: ClientProxy) {}

  async onModuleDestroy(): Promise<void> {
    await this.dialogClient.close();
  }
}
