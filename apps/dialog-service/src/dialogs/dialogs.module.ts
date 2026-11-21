import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { InternalAuthGuard } from '../auth/internal-auth.guard';
import { DialogConfigService } from '../config/dialog-config.service';
import { DatabaseModule } from '../db/database.module';
import { DialogGraphService, LLM_SERVICE_CLIENT } from './dialog-graph.service';
import { DialogsController } from './dialogs.controller';
import { DialogsRepository } from './dialogs.repository';
import { DialogsService } from './dialogs.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DialogsController],
  providers: [
    {
      provide: LLM_SERVICE_CLIENT,
      inject: [DialogConfigService],
      useFactory: (config: DialogConfigService): ClientProxy =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: config.llmServiceHost,
            port: config.llmServicePort,
          },
        }),
    },
    InternalAuthGuard,
    DialogsRepository,
    DialogGraphService,
    DialogsService,
  ],
  exports: [DialogsService, DialogsRepository],
})
export class DialogsModule implements OnModuleDestroy {
  constructor(@Inject(LLM_SERVICE_CLIENT) private readonly llmClient: ClientProxy) {}

  async onModuleDestroy(): Promise<void> {
    await this.llmClient.close();
  }
}
