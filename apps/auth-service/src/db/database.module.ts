import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { AuthConfigModule } from '../config/auth-config.module';
import { AuthConfigService } from '../config/auth-config.service';
import * as schema from './schema';

export const PG_POOL = Symbol('PG_POOL');
export const DRIZZLE = Symbol('DRIZZLE');
export type AuthDatabase = NodePgDatabase<typeof schema>;

@Module({
  imports: [AuthConfigModule],
  providers: [
    {
      provide: PG_POOL,
      useFactory: (config: AuthConfigService): Pool => {
        return new Pool({
          connectionString: config.databaseUrl || undefined,
        });
      },
      inject: [AuthConfigService],
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
