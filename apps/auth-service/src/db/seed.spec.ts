import { PasswordHasher } from '@nestjs/authentication';
import { UserRole } from '@semcache/shared-types';
import { CredentialsService } from '../auth/credentials.service';
import {
  type MockUsersRepository,
  type StoredUserRecord,
  createInMemoryUsersRepository,
} from '../../test/in-memory-users.repository';
import type { UsersRepository } from '../users/users.repository';
import { buildDefaultSeedAccounts, seedAuthUsers, seedEnvSchema } from './seed';

describe('seedAuthUsers', () => {
  let passwordHasher: PasswordHasher;
  let storedUsers: Map<string, StoredUserRecord>;
  let usersRepositoryMock: MockUsersRepository;
  let credentialsService: CredentialsService;

  beforeEach(() => {
    passwordHasher = new PasswordHasher({ logN: 10 });
    ({ storedUsers, usersRepositoryMock } = createInMemoryUsersRepository());

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
