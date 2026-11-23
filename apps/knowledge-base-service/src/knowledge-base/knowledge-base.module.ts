import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ConfigService, resolveServiceTcpEndpoint } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { InternalIdentityAuth } from '../auth/internal-identity.provider';
import type { KnowledgeBaseEnv } from '../config/knowledge-base.env';
import { DatabaseModule } from '../db/database.module';
import { KnowledgeBasePolicy } from '../policies/knowledge-base.policy';
import { DocumentProcessorService } from './document-processor.service';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KnowledgeBaseRepository } from './knowledge-base.repository';
import { KnowledgeBaseService, LLM_SERVICE_CLIENT } from './knowledge-base.service';

@Module({
  imports: [DatabaseModule],
  controllers: [KnowledgeBaseController],
  providers: [
    {
      provide: LLM_SERVICE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<KnowledgeBaseEnv, true>): ClientProxy => {
        const { host, port } = resolveServiceTcpEndpoint(config, ServiceName.LLM_SERVICE, {
          hostKey: 'LLM_SERVICE_HOST',
          portKey: 'LLM_SERVICE_PORT',
          urlKey: 'LLM_SERVICE_URL',
        });
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: { host, port },
        });
      },
    },
    InternalIdentityAuth,
    KnowledgeBasePolicy,
    DocumentProcessorService,
    KnowledgeBaseRepository,
    KnowledgeBaseService,
  ],
  exports: [KnowledgeBaseService, KnowledgeBaseRepository, KnowledgeBasePolicy],
})
export class KnowledgeBaseModule implements OnModuleDestroy {
  constructor(@Inject(LLM_SERVICE_CLIENT) private readonly llmClient: ClientProxy) {}

  async onModuleDestroy(): Promise<void> {
    await this.llmClient.close();
  }
}
