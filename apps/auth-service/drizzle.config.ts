import { createServiceDrizzleConfig } from '@semcache/shared-config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig(createServiceDrizzleConfig('__drizzle_migrations_auth'));
