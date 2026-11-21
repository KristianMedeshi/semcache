import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { GatewayConfigService } from '../config/gateway-config.service';
import { AUTH_SERVICE_CLIENT, AuthProxyService } from './auth-proxy.service';
import { GatewayAuthController } from './gateway-auth.controller';
import { GatewaySessionAuth } from './gateway-session.provider';
import { GatewayAdminUsersController, GatewayUsersController } from './gateway-users.controller';
import { GatewayAccessPolicy } from './policies/gateway-access.policy';

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
    GatewaySessionAuth,
    GatewayAccessPolicy,
  ],
  exports: [AuthProxyService, GatewayAccessPolicy],
})
export class GatewayAuthModule implements OnModuleDestroy {
  constructor(@Inject(AUTH_SERVICE_CLIENT) private readonly authClient: ClientProxy) {}

  async onModuleDestroy(): Promise<void> {
    await this.authClient.close();
  }
}
