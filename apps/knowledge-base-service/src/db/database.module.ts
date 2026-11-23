import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@semcache/shared-config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { KnowledgeBaseEnv } from '../config/knowledge-base.env';
import * as schema from './schema';

export const KB_PG_POOL = Symbol('KB_PG_POOL');
export const KB_DRIZZLE = Symbol('KB_DRIZZLE');
export type KnowledgeBaseDatabase = NodePgDatabase<typeof schema>;

@Module({
  providers: [
    {
      provide: KB_PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<KnowledgeBaseEnv, true>): Pool =>
        new Pool({ connectionString: config.get('DATABASE_URL') || undefined }),
    },
    {
      provide: KB_DRIZZLE,
      inject: [KB_PG_POOL],
      useFactory: (pool: Pool): KnowledgeBaseDatabase => drizzle(pool, { schema }),
    },
  ],
  exports: [KB_DRIZZLE, KB_PG_POOL],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(KB_PG_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
