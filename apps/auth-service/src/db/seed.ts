import { NestFactory } from '@nestjs/core';
import { createValidatedConfigService, databaseOnlyEnvSchema, z } from '@semcache/shared-config';
import {
  AUTH_VALIDATION_LIMITS,
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_REGEX,
  type UserResponseDto,
} from '@semcache/shared-dtos';
import { UserRole } from '@semcache/shared-types';
import { AppModule } from '../app.module';
import { CredentialsService } from '../auth/credentials.service';
import { UsersRepository } from '../users/users.repository';

export interface SeedAccount {
  email: string;
  password: string;
  role: UserRole;
}

export const seedEnvSchema = databaseOnlyEnvSchema.extend({
  SEED_CUSTOMER_PASSWORD: z
    .string()
    .trim()
    .min(AUTH_VALIDATION_LIMITS.PASSWORD_MIN_LENGTH)
    .max(AUTH_VALIDATION_LIMITS.PASSWORD_MAX_LENGTH)
    .regex(PASSWORD_COMPLEXITY_REGEX, PASSWORD_COMPLEXITY_MESSAGE),
  SEED_ADMIN_PASSWORD: z
    .string()
    .trim()
    .min(AUTH_VALIDATION_LIMITS.PASSWORD_MIN_LENGTH)
    .max(AUTH_VALIDATION_LIMITS.PASSWORD_MAX_LENGTH)
    .regex(PASSWORD_COMPLEXITY_REGEX, PASSWORD_COMPLEXITY_MESSAGE),
});

export type SeedEnv = z.infer<typeof seedEnvSchema>;

/**
 * Builds the canonical default customer and admin accounts from validated seed env vars.
 */
export function buildDefaultSeedAccounts(
  env: Pick<SeedEnv, 'SEED_CUSTOMER_PASSWORD' | 'SEED_ADMIN_PASSWORD'>,
): SeedAccount[] {
  return [
    {
      email: 'customer@example.com',
      password: env.SEED_CUSTOMER_PASSWORD,
      role: UserRole.CUSTOMER,
    },
    {
      email: 'admin@example.com',
      password: env.SEED_ADMIN_PASSWORD,
      role: UserRole.ADMIN,
    },
  ];
}

/**
 * Idempotently seeds accounts using `CredentialsService` and `UsersRepository` so hashing,
 * normalization, and persistence match the NestJS auth registration flow.
 */
export async function seedAuthUsers(
  credentialsService: Pick<CredentialsService, 'createAccount'>,
  usersRepository: Pick<UsersRepository, 'findByEmail'>,
  accounts: readonly SeedAccount[],
): Promise<UserResponseDto[]> {
  const seeded: UserResponseDto[] = [];

  for (const account of accounts) {
    const existing = await usersRepository.findByEmail(account.email);
    if (existing) {
      seeded.push(existing);
      continue;
    }

    const created = await credentialsService.createAccount(
      account.email,
      account.password,
      account.role,
    );
    seeded.push(created);
  }

  return seeded;
}

/**
 * CLI entrypoint for seeding the `auth-service` database via the NestJS application context.
 */
export async function runSeed(): Promise<void> {
  const config = createValidatedConfigService(seedEnvSchema);
  const accounts = buildDefaultSeedAccounts({
    SEED_CUSTOMER_PASSWORD: config.getOrThrow('SEED_CUSTOMER_PASSWORD'),
    SEED_ADMIN_PASSWORD: config.getOrThrow('SEED_ADMIN_PASSWORD'),
  });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const credentialsService = app.get(CredentialsService);
    const usersRepository = app.get(UsersRepository);
    const seededUsers = await seedAuthUsers(credentialsService, usersRepository, accounts);
    for (const user of seededUsers) {
      console.info(`Seeded user ${user.email} (${user.role}) [${user.id}]`);
    }
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  runSeed().catch((error: unknown) => {
    console.error('Failed to seed auth database:', error);
    process.exitCode = 1;
  });
}
