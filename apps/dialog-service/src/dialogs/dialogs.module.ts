import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ConfigService, resolveServiceTcpEndpoint } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { InternalIdentityAuth } from '../auth/internal-identity.provider';
import type { DialogEnv } from '../config/dialog.env';
import { DatabaseModule } from '../db/database.module';
import { DialogGraphService, LLM_SERVICE_CLIENT } from './dialog-graph.service';
import { DialogsController } from './dialogs.controller';
import { DialogsRepository } from './dialogs.repository';
import { DialogsService } from './dialogs.service';
import { DialogPolicy } from './policies/dialog.policy';

@Module({
  imports: [DatabaseModule],
  controllers: [DialogsController],
  providers: [
    {
      provide: LLM_SERVICE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<DialogEnv, true>): ClientProxy => {
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
    DialogPolicy,
    DialogsRepository,
    DialogGraphService,
    DialogsService,
  ],
  exports: [DialogsService, DialogsRepository, DialogPolicy],
})
export class DialogsModule implements OnModuleDestroy {
  constructor(@Inject(LLM_SERVICE_CLIENT) private readonly llmClient: ClientProxy) {}

  async onModuleDestroy(): Promise<void> {
    await this.llmClient.close();
  }
}
