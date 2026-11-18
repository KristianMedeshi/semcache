import { Inject, Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type SessionRecord,
  type SessionStore,
} from '@nestjs/authentication';
import { and, eq, lt, lte } from 'drizzle-orm';
import { type AuthDatabase, DRIZZLE } from '../db/database.module';
import { type SessionRow, sessions, users } from '../db/schema';
import { toUserResponseDto } from '../users/users.repository';

function toSessionRecord(row: SessionRow): SessionRecord {
  const record: SessionRecord = {
    id: row.id,
    userId: row.userId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    lastActiveAt: row.lastActiveAt,
  };
  if (row.metadata !== null) {
    record.metadata = row.metadata;
  }
  return record;
}

/**
 * Keeps sessions in PostgreSQL through Drizzle ORM for `@nestjs/authentication`.
 */
@Injectable()
export class DrizzleSessionStore implements SessionStore {
  constructor(
    @Inject(DRIZZLE) private readonly db: AuthDatabase,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ sessions: this });
  }

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const rows = await this.db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return undefined;
    }

    return {
      ...toSessionRecord(row.session),
      extra: { user: toUserResponseDto(row.user) },
    };
  }

  async createSession(record: SessionRecord): Promise<void> {
    await this.db.insert(sessions).values({
      id: record.id,
      userId: record.userId,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      lastActiveAt: record.lastActiveAt,
      metadata: record.metadata ?? null,
    });
    await this.db.delete(sessions).where(lte(sessions.expiresAt, record.createdAt));
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    await this.db
      .update(sessions)
      .set({ lastActiveAt })
      .where(and(eq(sessions.id, id), lt(sessions.lastActiveAt, lastActiveAt)));
  }

  async deleteSession(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(sessions)
      .where(eq(sessions.id, id))
      .returning({ id: sessions.id });
    return deleted.length > 0;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    const rows = await this.db.select().from(sessions).where(eq(sessions.userId, userId));
    return rows.map(toSessionRecord);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }
}
