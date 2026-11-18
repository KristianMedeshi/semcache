import { Module } from '@nestjs/common';
import { AuthProxyService } from './auth-proxy.service';
import { GatewayAuthController } from './gateway-auth.controller';
import { GatewayAdminUsersController, GatewayUsersController } from './gateway-users.controller';

@Module({
  controllers: [GatewayAuthController, GatewayUsersController, GatewayAdminUsersController],
  providers: [AuthProxyService],
  exports: [AuthProxyService],
})
export class GatewayAuthModule {}
