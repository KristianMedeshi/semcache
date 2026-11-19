import { getRequiredEnv, loadEnv } from '@semcache/shared-config';
import { defineConfig } from 'drizzle-kit';

loadEnv();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: getRequiredEnv('DATABASE_URL'),
  },
  migrations: {
    table: '__drizzle_migrations_dialog',
    schema: 'public',
  },
  strict: true,
  verbose: true,
});
