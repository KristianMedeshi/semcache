import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { GatewayConfigService } from '../config/gateway-config.service';
import { AUTH_SERVICE_CLIENT, AuthProxyService } from './auth-proxy.service';
import { GatewayAuthController } from './gateway-auth.controller';
import { GatewayAdminUsersController, GatewayUsersController } from './gateway-users.controller';

@Module({
  controllers: [GatewayAuthController, GatewayUsersController, GatewayAdminUsersController],
  providers: [
    {
      provide: AUTH_SERVICE_CLIENT,
      inject: [GatewayConfigService],
      useFactory: (config: GatewayConfigService): ClientProxy =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: config.authServiceHost,
            port: config.authServicePort,
          },
        }),
    },
    AuthProxyService,
  ],
  exports: [AuthProxyService],
})
export class GatewayAuthModule implements OnModuleDestroy {
  constructor(@Inject(AUTH_SERVICE_CLIENT) private readonly authClient: ClientProxy) {}

  async onModuleDestroy(): Promise<void> {
    await this.authClient.close();
  }
}
