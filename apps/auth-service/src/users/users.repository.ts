import { Inject, Injectable } from '@nestjs/common';
import type { UserResponseDto } from '@semcache/shared-dtos';
import { UserRole } from '@semcache/shared-types';
import { asc, eq } from 'drizzle-orm';
import { type AuthDatabase, DRIZZLE } from '../db/database.module';
import { type UserRecord, users } from '../db/schema';

export function normalizeEmail(email: string): string {
  return email.trim().normalize('NFC').toLowerCase();
}

export function toUserResponseDto(record: UserRecord): UserResponseDto {
  return {
    id: record.id,
    email: record.email,
    role: record.role as UserRole,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * Only `UserResponseDto` objects leave this repository: password hashes stay inside
 * except for explicit credential verification (`findCredentials`).
 */
@Injectable()
export class UsersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: AuthDatabase) {}

  async create(
    email: string,
    options: { passwordHash: string; role?: UserRole },
  ): Promise<UserResponseDto> {
    const rows = await this.db
      .insert(users)
      .values({
        email: normalizeEmail(email),
        passwordHash: options.passwordHash,
        role: options.role ?? UserRole.CUSTOMER,
      })
      .returning();

    const created = rows[0];
    if (!created) {
      throw new Error('Failed to insert user record');
    }
    return toUserResponseDto(created);
  }

  async findById(id: string): Promise<UserResponseDto | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    const record = rows[0];
    return record ? toUserResponseDto(record) : null;
  }

  async findByEmail(email: string): Promise<UserResponseDto | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, normalizeEmail(email)))
      .limit(1);
    const record = rows[0];
    return record ? toUserResponseDto(record) : null;
  }

  /** For password sign-in only. */
  async findCredentials(
    email: string,
  ): Promise<{ user: UserResponseDto; passwordHash: string } | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, normalizeEmail(email)))
      .limit(1);
    const record = rows[0];
    if (!record) {
      return null;
    }
    return {
      user: toUserResponseDto(record),
      passwordHash: record.passwordHash,
    };
  }

  async findAll(): Promise<UserResponseDto[]> {
    const rows = await this.db.select().from(users).orderBy(asc(users.createdAt));
    return rows.map(toUserResponseDto);
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async updateProfile(
    id: string,
    data: { email?: string; passwordHash?: string },
  ): Promise<UserResponseDto | null> {
    const updates: Partial<{ email: string; passwordHash: string; updatedAt: Date }> = {
      updatedAt: new Date(),
    };
    if (data.email !== undefined) {
      updates.email = normalizeEmail(data.email);
    }
    if (data.passwordHash !== undefined) {
      updates.passwordHash = data.passwordHash;
    }

    const rows = await this.db.update(users).set(updates).where(eq(users.id, id)).returning();
    const updated = rows[0];
    return updated ? toUserResponseDto(updated) : null;
  }
}
