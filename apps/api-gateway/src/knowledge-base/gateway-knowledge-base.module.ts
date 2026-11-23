import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ConfigService, resolveServiceTcpEndpoint } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { GatewayAuthModule } from '../auth/gateway-auth.module';
import type { GatewayEnv } from '../config/gateway.env';
import { GatewayKnowledgeBaseController } from './gateway-knowledge-base.controller';
import {
  KNOWLEDGE_BASE_SERVICE_CLIENT,
  KnowledgeBaseProxyService,
} from './knowledge-base-proxy.service';

@Module({
  imports: [GatewayAuthModule],
  controllers: [GatewayKnowledgeBaseController],
  providers: [
    {
      provide: KNOWLEDGE_BASE_SERVICE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<GatewayEnv, true>): ClientProxy => {
        const { host, port } = resolveServiceTcpEndpoint(
          config,
          ServiceName.KNOWLEDGE_BASE_SERVICE,
          {
            hostKey: 'KNOWLEDGE_BASE_SERVICE_HOST',
            portKey: 'KNOWLEDGE_BASE_SERVICE_PORT',
            urlKey: 'KNOWLEDGE_BASE_SERVICE_URL',
          },
        );
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: { host, port },
        });
      },
    },
    KnowledgeBaseProxyService,
  ],
})
export class GatewayKnowledgeBaseModule implements OnModuleDestroy {
  constructor(@Inject(KNOWLEDGE_BASE_SERVICE_CLIENT) private readonly kbClient: ClientProxy) {}

  async onModuleDestroy(): Promise<void> {
    await this.kbClient.close();
  }
}
