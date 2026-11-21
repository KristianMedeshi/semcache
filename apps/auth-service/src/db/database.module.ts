import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@semcache/shared-config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { AuthEnv } from '../config/auth.env';
import * as schema from './schema';

export const PG_POOL = Symbol('PG_POOL');
export const DRIZZLE = Symbol('DRIZZLE');
export type AuthDatabase = NodePgDatabase<typeof schema>;

@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (config: ConfigService<AuthEnv, true>): Pool => {
        return new Pool({
          connectionString: config.get('DATABASE_URL') || undefined,
        });
      },
      inject: [ConfigService],
    },
    {
      provide: DRIZZLE,
      useFactory: (pool: Pool): AuthDatabase => {
        return drizzle(pool, { schema });
      },
      inject: [PG_POOL],
    },
  ],
  exports: [DRIZZLE, PG_POOL],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
