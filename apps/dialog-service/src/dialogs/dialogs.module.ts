import { Module } from '@nestjs/common';
import { InternalAuthGuard } from '../auth/internal-auth.guard';
import { DatabaseModule } from '../db/database.module';
import { DialogGraphService } from './dialog-graph.service';
import { DialogsController } from './dialogs.controller';
import { DialogsRepository } from './dialogs.repository';
import { DialogsService } from './dialogs.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DialogsController],
  providers: [InternalAuthGuard, DialogsRepository, DialogGraphService, DialogsService],
  exports: [DialogsService, DialogsRepository],
})
export class DialogsModule {}
