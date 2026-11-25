import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { createTcpClientProvider } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { GatewayAuthModule } from '../auth/gateway-auth.module';
import { MetricsModule } from '../metrics/metrics.module';
import { GatewaySemanticCacheController } from './gateway-semantic-cache.controller';
import {
  SEMANTIC_CACHE_SERVICE_CLIENT,
  SemanticCacheProxyService,
} from './semantic-cache-proxy.service';

@Module({
  imports: [GatewayAuthModule, MetricsModule],
  controllers: [GatewaySemanticCacheController],
  providers: [
    createTcpClientProvider(SEMANTIC_CACHE_SERVICE_CLIENT, ServiceName.SEMANTIC_CACHE_SERVICE),
    SemanticCacheProxyService,
  ],
})
export class GatewaySemanticCacheModule implements OnModuleDestroy {
  constructor(
    @Inject(SEMANTIC_CACHE_SERVICE_CLIENT) private readonly semanticCacheClient: ClientProxy,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.semanticCacheClient.close();
  }
}
