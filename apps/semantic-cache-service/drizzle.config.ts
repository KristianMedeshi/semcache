import { createValidatedConfigService, databaseOnlyEnvSchema } from '@semcache/shared-config';
import { defineConfig } from 'drizzle-kit';

const configService = createValidatedConfigService(databaseOnlyEnvSchema);

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: configService.getOrThrow<string>('DATABASE_URL'),
  },
  migrations: {
    table: '__drizzle_migrations_semantic_cache',
    schema: 'public',
  },
  strict: true,
  verbose: true,
});
