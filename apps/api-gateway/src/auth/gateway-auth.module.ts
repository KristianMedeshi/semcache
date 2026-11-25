import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { createTcpClientProvider } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { AUTH_SERVICE_CLIENT, AuthProxyService } from './auth-proxy.service';
import { GatewayAuthController } from './gateway-auth.controller';
import { GatewaySessionAuth } from './gateway-session.provider';
import { GatewayAdminUsersController, GatewayUsersController } from './gateway-users.controller';
import { GatewayAccessPolicy } from './policies/gateway-access.policy';

@Module({
  controllers: [GatewayAuthController, GatewayUsersController, GatewayAdminUsersController],
  providers: [
    createTcpClientProvider(AUTH_SERVICE_CLIENT, ServiceName.AUTH_SERVICE),
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
