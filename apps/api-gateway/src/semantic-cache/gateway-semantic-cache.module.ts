import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ConfigService, resolveServiceTcpEndpoint } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { GatewayAuthModule } from '../auth/gateway-auth.module';
import type { GatewayEnv } from '../config/gateway.env';
import { GatewaySemanticCacheController } from './gateway-semantic-cache.controller';
import {
  SEMANTIC_CACHE_SERVICE_CLIENT,
  SemanticCacheProxyService,
} from './semantic-cache-proxy.service';

@Module({
  imports: [GatewayAuthModule],
  controllers: [GatewaySemanticCacheController],
  providers: [
    {
      provide: SEMANTIC_CACHE_SERVICE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<GatewayEnv, true>): ClientProxy => {
        const { host, port } = resolveServiceTcpEndpoint(
          config,
          ServiceName.SEMANTIC_CACHE_SERVICE,
          {
            hostKey: 'SEMANTIC_CACHE_SERVICE_HOST',
            portKey: 'SEMANTIC_CACHE_SERVICE_PORT',
            urlKey: 'SEMANTIC_CACHE_SERVICE_URL',
          },
        );
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: { host, port },
        });
      },
    },
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
