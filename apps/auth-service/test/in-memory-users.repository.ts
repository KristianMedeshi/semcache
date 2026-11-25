import type { UserResponseDto } from '@semcache/shared-dtos';
import { UserRole } from '@semcache/shared-types';
import { UsersRepository, normalizeEmail } from '../src/users/users.repository';

export interface StoredUserRecord {
  user: UserResponseDto;
  passwordHash: string;
}

export type MockUsersRepository = Pick<
  UsersRepository,
  'findByEmail' | 'findCredentials' | 'create' | 'updatePasswordHash'
>;

export function createInMemoryUsersRepository(
  storedUsers: Map<string, StoredUserRecord> = new Map(),
): {
  storedUsers: Map<string, StoredUserRecord>;
  usersRepositoryMock: MockUsersRepository;
} {
  const usersRepositoryMock: MockUsersRepository = {
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
        id: `00000000-0000-4000-8000-${String(storedUsers.size + 1).padStart(12, '0')}`,
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

  return { storedUsers, usersRepositoryMock };
}
