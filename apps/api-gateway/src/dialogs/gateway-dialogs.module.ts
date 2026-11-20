import { Module } from '@nestjs/common';
import { GatewayAuthModule } from '../auth/gateway-auth.module';
import { DialogProxyService } from './dialog-proxy.service';
import { GatewayDialogsController } from './gateway-dialogs.controller';

@Module({
  imports: [GatewayAuthModule],
  controllers: [GatewayDialogsController],
  providers: [DialogProxyService],
})
export class GatewayDialogsModule {}
