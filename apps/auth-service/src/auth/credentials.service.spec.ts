import { ConflictException } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { UserRole } from '@semcache/shared-types';
import {
  type MockUsersRepository,
  type StoredUserRecord,
  createInMemoryUsersRepository,
} from '../../test/in-memory-users.repository';
import type { UsersRepository } from '../users/users.repository';
import { CredentialsService } from './credentials.service';

describe('CredentialsService', () => {
  let credentialsService: CredentialsService;
  let passwordHasher: PasswordHasher;
  let storedUsers: Map<string, StoredUserRecord>;
  let usersRepositoryMock: MockUsersRepository;

  beforeEach(() => {
    passwordHasher = new PasswordHasher({ logN: 10 });
    ({ storedUsers, usersRepositoryMock } = createInMemoryUsersRepository());

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

  it('maps concurrent PostgreSQL unique violation (23505) on create to ConflictException', async () => {
    const createSpy = jest
      .spyOn(usersRepositoryMock, 'create')
      .mockRejectedValueOnce(new Error('Failed query', { cause: { code: '23505' } }));

    await expect(
      credentialsService.register('race@example.com', 'StrongPass123!'),
    ).rejects.toThrow(ConflictException);
    expect(createSpy).toHaveBeenCalledTimes(1);
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
