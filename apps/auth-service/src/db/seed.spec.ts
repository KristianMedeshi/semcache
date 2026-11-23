import { PasswordHasher } from '@nestjs/authentication';
import type { UserResponseDto } from '@semcache/shared-dtos';
import { UserRole } from '@semcache/shared-types';
import { CredentialsService } from '../auth/credentials.service';
import { UsersRepository, normalizeEmail } from '../users/users.repository';
import { buildDefaultSeedAccounts, seedAuthUsers, seedEnvSchema } from './seed';

describe('seedAuthUsers', () => {
  let passwordHasher: PasswordHasher;
  let storedUsers: Map<string, { user: UserResponseDto; passwordHash: string }>;
  let usersRepositoryMock: Pick<
    UsersRepository,
    'findByEmail' | 'findCredentials' | 'create' | 'updatePasswordHash'
  >;
  let credentialsService: CredentialsService;

  beforeEach(() => {
    passwordHasher = new PasswordHasher({ logN: 10 });
    storedUsers = new Map();

    usersRepositoryMock = {
      async findByEmail(email: string) {
        return storedUsers.get(normalizeEmail(email))?.user ?? null;
      },
      async findCredentials(email: string) {
        return storedUsers.get(normalizeEmail(email)) ?? null;
      },
      async create(email: string, options: { passwordHash: string; role?: UserRole }) {
        const normalized = normalizeEmail(email);
        const now = new Date().toISOString();
        const user: UserResponseDto = {
          id: `00000000-0000-4000-8000-00000000000${storedUsers.size + 1}`,
          email: normalized,
          role: options.role ?? UserRole.CUSTOMER,
          createdAt: now,
          updatedAt: now,
        };
        storedUsers.set(normalized, { user, passwordHash: options.passwordHash });
        return user;
      },
      async updatePasswordHash(id: string, passwordHash: string) {
        for (const entry of storedUsers.values()) {
          if (entry.user.id === id) {
            entry.passwordHash = passwordHash;
          }
        }
      },
    };

    credentialsService = new CredentialsService(
      usersRepositoryMock as UsersRepository,
      passwordHasher,
    );
  });

  it('builds default customer and admin accounts from validated env', () => {
    const parsed = seedEnvSchema.parse({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/semcache',
      SEED_CUSTOMER_PASSWORD: 'CustomerPass123!',
      SEED_ADMIN_PASSWORD: 'AdminPass123!',
    });

    const accounts = buildDefaultSeedAccounts(parsed);
    expect(accounts).toEqual([
      {
        email: 'customer@example.com',
        password: 'CustomerPass123!',
        role: UserRole.CUSTOMER,
      },
      {
        email: 'admin@example.com',
        password: 'AdminPass123!',
        role: UserRole.ADMIN,
      },
    ]);
  });

  it('seeds customer and admin users through CredentialsService and is idempotent', async () => {
    const accounts = buildDefaultSeedAccounts({
      SEED_CUSTOMER_PASSWORD: 'CustomerPass123!',
      SEED_ADMIN_PASSWORD: 'AdminPass123!',
    });

    const firstRun = await seedAuthUsers(
      credentialsService,
      usersRepositoryMock as UsersRepository,
      accounts,
    );
    expect(firstRun).toHaveLength(2);
    expect(firstRun[0]?.email).toBe('customer@example.com');
    expect(firstRun[0]?.role).toBe(UserRole.CUSTOMER);
    expect(firstRun[1]?.email).toBe('admin@example.com');
    expect(firstRun[1]?.role).toBe(UserRole.ADMIN);

    await expect(
      credentialsService.verify('customer@example.com', 'CustomerPass123!'),
    ).resolves.toMatchObject({ email: 'customer@example.com', role: UserRole.CUSTOMER });
    await expect(
      credentialsService.verify('admin@example.com', 'AdminPass123!'),
    ).resolves.toMatchObject({ email: 'admin@example.com', role: UserRole.ADMIN });

    const secondRun = await seedAuthUsers(
      credentialsService,
      usersRepositoryMock as UsersRepository,
      accounts,
    );
    expect(secondRun).toHaveLength(2);
    expect(storedUsers.size).toBe(2);
    expect(secondRun[0]?.id).toBe(firstRun[0]?.id);
    expect(secondRun[1]?.id).toBe(firstRun[1]?.id);
  });
});
