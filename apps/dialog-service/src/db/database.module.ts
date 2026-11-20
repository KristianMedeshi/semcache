import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DialogConfigModule } from '../config/dialog-config.module';
import { DialogConfigService } from '../config/dialog-config.service';
import * as schema from './schema';

export const DIALOG_PG_POOL = Symbol('DIALOG_PG_POOL');
export const DIALOG_DRIZZLE = Symbol('DIALOG_DRIZZLE');
export type DialogDatabase = NodePgDatabase<typeof schema>;

@Module({
  imports: [DialogConfigModule],
  providers: [
    {
      provide: DIALOG_PG_POOL,
      inject: [DialogConfigService],
      useFactory: (config: DialogConfigService): Pool =>
        new Pool({ connectionString: config.databaseUrl || undefined }),
    },
    {
      provide: DIALOG_DRIZZLE,
      inject: [DIALOG_PG_POOL],
      useFactory: (pool: Pool): DialogDatabase => drizzle(pool, { schema }),
    },
  ],
  exports: [DIALOG_DRIZZLE, DIALOG_PG_POOL],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(DIALOG_PG_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
