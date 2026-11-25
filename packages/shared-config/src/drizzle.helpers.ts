import { databaseOnlyEnvSchema } from './env.validation';
import { createValidatedConfigService } from './shared-config.module';

export interface ServiceDrizzleConfig {
  dialect: 'postgresql';
  schema: string;
  out: string;
  dbCredentials: {
    url: string;
  };
  migrations: {
    table: string;
    schema: string;
  };
  strict: boolean;
  verbose: boolean;
}

/**
 * Builds a Drizzle Kit PostgreSQL configuration for an individual microservice's
 * isolated schema and migrations table.
 */
export function createServiceDrizzleConfig(migrationsTable: string): ServiceDrizzleConfig {
  const configService = createValidatedConfigService(databaseOnlyEnvSchema);

  return {
    dialect: 'postgresql',
    schema: './src/db/schema.ts',
    out: './drizzle',
    dbCredentials: {
      url: configService.getOrThrow<string>('DATABASE_URL'),
    },
    migrations: {
      table: migrationsTable,
      schema: 'public',
    },
    strict: true,
    verbose: true,
  };
}
