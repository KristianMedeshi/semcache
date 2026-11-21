import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ConfigService, resolveServiceTcpEndpoint } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import type { GatewayEnv } from '../config/gateway.env';
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
      inject: [ConfigService],
      useFactory: (config: ConfigService<GatewayEnv, true>): ClientProxy => {
        const { host, port } = resolveServiceTcpEndpoint(config, ServiceName.AUTH_SERVICE, {
          hostKey: 'AUTH_SERVICE_HOST',
          portKey: 'AUTH_SERVICE_PORT',
          urlKey: 'AUTH_SERVICE_URL',
        });
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: { host, port },
        });
      },
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
