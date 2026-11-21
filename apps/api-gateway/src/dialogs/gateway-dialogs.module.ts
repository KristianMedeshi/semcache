import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { GatewayAuthModule } from '../auth/gateway-auth.module';
import { GatewayConfigService } from '../config/gateway-config.service';
import { DIALOG_SERVICE_CLIENT, DialogProxyService } from './dialog-proxy.service';
import { GatewayDialogsController } from './gateway-dialogs.controller';

@Module({
  imports: [GatewayAuthModule],
  controllers: [GatewayDialogsController],
  providers: [
    {
      provide: DIALOG_SERVICE_CLIENT,
      inject: [GatewayConfigService],
      useFactory: (config: GatewayConfigService): ClientProxy =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: config.dialogServiceHost,
            port: config.dialogServicePort,
          },
        }),
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
