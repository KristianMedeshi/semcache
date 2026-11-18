import { ConflictException } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import type { UserResponseDto } from '@semcache/shared-dtos';
import { UserRole } from '@semcache/shared-types';
import { UsersRepository, normalizeEmail } from '../users/users.repository';
import { CredentialsService } from './credentials.service';

describe('CredentialsService', () => {
  let credentialsService: CredentialsService;
  let passwordHasher: PasswordHasher;
  let storedUsers: Map<string, { user: UserResponseDto; passwordHash: string }>;
  let usersRepositoryMock: Pick<
    UsersRepository,
    'findByEmail' | 'findCredentials' | 'create' | 'updatePasswordHash'
  >;

  beforeEach(() => {
    passwordHasher = new PasswordHasher({ logN: 10 });
    storedUsers = new Map();

    usersRepositoryMock = {
      async findByEmail(email: string) {
        const entry = storedUsers.get(normalizeEmail(email));
        return entry ? entry.user : null;
      },
      async findCredentials(email: string) {
        const entry = storedUsers.get(normalizeEmail(email));
        return entry ?? null;
      },
      async create(email: string, options: { passwordHash: string; role?: UserRole }) {
        const normalized = normalizeEmail(email);
        const now = new Date().toISOString();
        const user: UserResponseDto = {
          id: '11111111-1111-4111-8111-111111111111',
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

  it('registers a customer with normalized email and non-plaintext password hash', async () => {
    const user = await credentialsService.register('  Alice@Example.COM ', 'StrongPass123!');

    expect(user.email).toBe('alice@example.com');
    expect(user.role).toBe(UserRole.CUSTOMER);
    expect('passwordHash' in user).toBe(false);

    const record = storedUsers.get('alice@example.com');
    expect(record?.passwordHash).toMatch(/^\$scrypt\$/);
    expect(record?.passwordHash).not.toContain('StrongPass123!');
  });

  it('rejects duplicate email registration with ConflictException', async () => {
    await credentialsService.register('alice@example.com', 'StrongPass123!');

    await expect(
      credentialsService.register('ALICE@example.com', 'AnotherPass123!'),
    ).rejects.toThrow(ConflictException);
  });

  it('verifies valid credentials and rejects wrong password or unknown email', async () => {
    await credentialsService.register('bob@example.com', 'StrongPass123!');

    const verified = await credentialsService.verify('bob@example.com', 'StrongPass123!');
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe('bob@example.com');
    expect(verified && 'passwordHash' in verified).toBe(false);

    await expect(credentialsService.verify('bob@example.com', 'WrongPass123!')).resolves.toBeNull();
    await expect(
      credentialsService.verify('nobody@example.com', 'StrongPass123!'),
    ).resolves.toBeNull();
  });

  it('upgrades password hash on login when hash cost parameters increase', async () => {
    const oldHash = await passwordHasher.hash('StrongPass123!');
    await usersRepositoryMock.create('upgrade@example.com', {
      passwordHash: oldHash,
      role: UserRole.CUSTOMER,
    });

    const higherCostHasher = new PasswordHasher({ logN: 11 });
    const upgradedService = new CredentialsService(
      usersRepositoryMock as UsersRepository,
      higherCostHasher,
    );

    const verified = await upgradedService.verify('upgrade@example.com', 'StrongPass123!');
    expect(verified).not.toBeNull();

    const updated = storedUsers.get('upgrade@example.com');
    expect(updated?.passwordHash).not.toBe(oldHash);
    expect(higherCostHasher.needsRehash(updated?.passwordHash ?? '')).toBe(false);
  });
});
