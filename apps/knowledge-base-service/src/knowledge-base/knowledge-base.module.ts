import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { createTcpClientProvider } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { InternalIdentityAuth } from '../auth/internal-identity.provider';
import { DatabaseModule } from '../db/database.module';
import { KnowledgeBasePolicy } from '../policies/knowledge-base.policy';
import { DocumentProcessorService } from './document-processor.service';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KnowledgeBaseRepository } from './knowledge-base.repository';
import {
  EMBEDDING_SERVICE_CLIENT,
  KnowledgeBaseService,
  SEMANTIC_CACHE_SERVICE_CLIENT,
} from './knowledge-base.service';

@Module({
  imports: [DatabaseModule],
  controllers: [KnowledgeBaseController],
  providers: [
    createTcpClientProvider(EMBEDDING_SERVICE_CLIENT, ServiceName.EMBEDDING_SERVICE),
    createTcpClientProvider(SEMANTIC_CACHE_SERVICE_CLIENT, ServiceName.SEMANTIC_CACHE_SERVICE),
    InternalIdentityAuth,
    KnowledgeBasePolicy,
    DocumentProcessorService,
    KnowledgeBaseRepository,
    KnowledgeBaseService,
  ],
  exports: [KnowledgeBaseService],
})
export class KnowledgeBaseModule implements OnModuleDestroy {
  constructor(
    @Inject(EMBEDDING_SERVICE_CLIENT) private readonly embeddingClient: ClientProxy,
    @Inject(SEMANTIC_CACHE_SERVICE_CLIENT) private readonly semanticCacheClient: ClientProxy,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.embeddingClient.close(), this.semanticCacheClient.close()]);
  }
}
