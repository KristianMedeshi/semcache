import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { createTcpClientProvider } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { InternalIdentityAuth } from '../auth/internal-identity.provider';
import { DatabaseModule } from '../db/database.module';
import {
  DialogGraphService,
  KNOWLEDGE_BASE_SERVICE_CLIENT,
  LLM_SERVICE_CLIENT,
  SEMANTIC_CACHE_SERVICE_CLIENT,
} from './dialog-graph.service';
import { DialogsController } from './dialogs.controller';
import { DialogsRepository } from './dialogs.repository';
import { DialogsService } from './dialogs.service';
import { DialogPolicy } from './policies/dialog.policy';

@Module({
  imports: [DatabaseModule],
  controllers: [DialogsController],
  providers: [
    createTcpClientProvider(LLM_SERVICE_CLIENT, ServiceName.LLM_SERVICE),
    createTcpClientProvider(KNOWLEDGE_BASE_SERVICE_CLIENT, ServiceName.KNOWLEDGE_BASE_SERVICE),
    createTcpClientProvider(SEMANTIC_CACHE_SERVICE_CLIENT, ServiceName.SEMANTIC_CACHE_SERVICE),
    InternalIdentityAuth,
    DialogPolicy,
    DialogsRepository,
    DialogGraphService,
    DialogsService,
  ],
  exports: [DialogsService, DialogsRepository, DialogPolicy],
})
export class DialogsModule implements OnModuleDestroy {
  constructor(
    @Inject(LLM_SERVICE_CLIENT) private readonly llmClient: ClientProxy,
    @Inject(KNOWLEDGE_BASE_SERVICE_CLIENT) private readonly kbClient: ClientProxy,
    @Inject(SEMANTIC_CACHE_SERVICE_CLIENT) private readonly semanticCacheClient: ClientProxy,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.llmClient.close(),
      this.kbClient.close(),
      this.semanticCacheClient.close(),
    ]);
  }
}
