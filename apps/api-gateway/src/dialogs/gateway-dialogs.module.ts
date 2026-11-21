import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ConfigService, resolveServiceTcpEndpoint } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { GatewayAuthModule } from '../auth/gateway-auth.module';
import type { GatewayEnv } from '../config/gateway.env';
import { DIALOG_SERVICE_CLIENT, DialogProxyService } from './dialog-proxy.service';
import { GatewayDialogsController } from './gateway-dialogs.controller';

@Module({
  imports: [GatewayAuthModule],
  controllers: [GatewayDialogsController],
  providers: [
    {
      provide: DIALOG_SERVICE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<GatewayEnv, true>): ClientProxy => {
        const { host, port } = resolveServiceTcpEndpoint(config, ServiceName.DIALOG_SERVICE, {
          hostKey: 'DIALOG_SERVICE_HOST',
          portKey: 'DIALOG_SERVICE_PORT',
          urlKey: 'DIALOG_SERVICE_URL',
        });
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: { host, port },
        });
      },
    },
    DialogProxyService,
  ],
})
export class GatewayDialogsModule implements OnModuleDestroy {
  constructor(@Inject(DIALOG_SERVICE_CLIENT) private readonly dialogClient: ClientProxy) {}

  async onModuleDestroy(): Promise<void> {
    await this.dialogClient.close();
  }
}
