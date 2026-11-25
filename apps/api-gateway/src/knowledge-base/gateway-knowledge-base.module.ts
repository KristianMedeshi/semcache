import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { createTcpClientProvider } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { GatewayAuthModule } from '../auth/gateway-auth.module';
import { MetricsModule } from '../metrics/metrics.module';
import { GatewayKnowledgeBaseController } from './gateway-knowledge-base.controller';
import {
  KNOWLEDGE_BASE_SERVICE_CLIENT,
  KnowledgeBaseProxyService,
} from './knowledge-base-proxy.service';

@Module({
  imports: [GatewayAuthModule, MetricsModule],
  controllers: [GatewayKnowledgeBaseController],
  providers: [
    createTcpClientProvider(KNOWLEDGE_BASE_SERVICE_CLIENT, ServiceName.KNOWLEDGE_BASE_SERVICE),
    KnowledgeBaseProxyService,
  ],
})
export class GatewayKnowledgeBaseModule implements OnModuleDestroy {
  constructor(@Inject(KNOWLEDGE_BASE_SERVICE_CLIENT) private readonly kbClient: ClientProxy) {}

  async onModuleDestroy(): Promise<void> {
    await this.kbClient.close();
  }
}
