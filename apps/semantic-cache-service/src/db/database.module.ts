import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@semcache/shared-config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { SemanticCacheEnv } from '../config/semantic-cache.env';
import * as schema from './schema';

export const SEMANTIC_CACHE_PG_POOL = Symbol('SEMANTIC_CACHE_PG_POOL');
export const SEMANTIC_CACHE_DRIZZLE = Symbol('SEMANTIC_CACHE_DRIZZLE');
export type SemanticCacheDatabase = NodePgDatabase<typeof schema>;

@Module({
  providers: [
    {
      provide: SEMANTIC_CACHE_PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<SemanticCacheEnv, true>): Pool =>
        new Pool({ connectionString: config.get('DATABASE_URL') || undefined }),
    },
    {
      provide: SEMANTIC_CACHE_DRIZZLE,
      inject: [SEMANTIC_CACHE_PG_POOL],
      useFactory: (pool: Pool): SemanticCacheDatabase => drizzle(pool, { schema }),
    },
  ],
  exports: [SEMANTIC_CACHE_DRIZZLE, SEMANTIC_CACHE_PG_POOL],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(SEMANTIC_CACHE_PG_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
