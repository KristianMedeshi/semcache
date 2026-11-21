import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@semcache/shared-config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { DialogEnv } from '../config/dialog.env';
import * as schema from './schema';

export const DIALOG_PG_POOL = Symbol('DIALOG_PG_POOL');
export const DIALOG_DRIZZLE = Symbol('DIALOG_DRIZZLE');
export type DialogDatabase = NodePgDatabase<typeof schema>;

@Module({
  providers: [
    {
      provide: DIALOG_PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<DialogEnv, true>): Pool =>
        new Pool({ connectionString: config.get('DATABASE_URL') || undefined }),
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
