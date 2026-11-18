import { randomUUID } from 'node:crypto';
import { Injectable, type INestApplication } from '@nestjs/common';
import {
  AuthenticationStorage,
  PasswordHasher,
  type SessionRecord,
  type SessionStore,
} from '@nestjs/authentication';
import { Test, type TestingModule } from '@nestjs/testing';
import type { UserResponseDto } from '@semcache/shared-dtos';
import { ServiceName, UserRole } from '@semcache/shared-types';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureAuthApp } from '../src/app.bootstrap';
import { AppModule } from '../src/app.module';
import { DrizzleSessionStore } from '../src/auth/drizzle-session.store';
import { UsersRepository, normalizeEmail } from '../src/users/users.repository';

interface InMemoryUserRow {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
class InMemoryUsersRepository {
  private readonly rows = new Map<string, InMemoryUserRow>();

  async create(
    email: string,
    options: { passwordHash: string; role?: UserRole },
  ): Promise<UserResponseDto> {
    const now = new Date();
    const row: InMemoryUserRow = {
      id: randomUUID(),
      email: normalizeEmail(email),
      passwordHash: options.passwordHash,
      role: options.role ?? UserRole.CUSTOMER,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return this.toDto(row);
  }

  async findById(id: string): Promise<UserResponseDto | null> {
    const row = this.rows.get(id);
    return row ? this.toDto(row) : null;
  }

  async findByEmail(email: string): Promise<UserResponseDto | null> {
    const row = this.findRowByEmail(email);
    return row ? this.toDto(row) : null;
  }

  async findCredentials(
    email: string,
  ): Promise<{ user: UserResponseDto; passwordHash: string } | null> {
    const row = this.findRowByEmail(email);
    return row ? { user: this.toDto(row), passwordHash: row.passwordHash } : null;
  }

  async findAll(): Promise<UserResponseDto[]> {
    return [...this.rows.values()].map((row) => this.toDto(row));
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    const row = this.rows.get(id);
    if (row) {
      row.passwordHash = passwordHash;
      row.updatedAt = new Date();
    }
  }

  async updateProfile(
    id: string,
    data: { email?: string; passwordHash?: string },
  ): Promise<UserResponseDto | null> {
    const row = this.rows.get(id);
    if (!row) {
      return null;
    }
    if (data.email !== undefined) {
      row.email = normalizeEmail(data.email);
    }
    if (data.passwordHash !== undefined) {
      row.passwordHash = data.passwordHash;
    }
    row.updatedAt = new Date();
    return this.toDto(row);
  }

  private findRowByEmail(email: string): InMemoryUserRow | undefined {
    const normalized = normalizeEmail(email);
    return [...this.rows.values()].find((row) => row.email === normalized);
  }

  private toDto(row: InMemoryUserRow): UserResponseDto {
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

@Injectable()
class InMemorySessionStore implements SessionStore {
  readonly sessions = new Map<string, SessionRecord>();

  constructor(
    storage: AuthenticationStorage,
    private readonly usersRepository: InMemoryUsersRepository,
  ) {
    storage.registerSource({ sessions: this });
  }

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const record = this.sessions.get(id);
    if (!record) {
      return undefined;
    }
    const user = await this.usersRepository.findById(record.userId);
    if (!user) {
      return { ...record };
    }
    return { ...record, extra: { user } };
  }

  async createSession(record: SessionRecord): Promise<void> {
    this.sessions.set(record.id, { ...record });
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    const existing = this.sessions.get(id);
    if (existing && existing.lastActiveAt.getTime() < lastActiveAt.getTime()) {
      existing.lastActiveAt = lastActiveAt;
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    return [...this.sessions.values()]
      .filter((session) => session.userId === userId)
      .map((session) => ({ ...session }));
  }

  async deleteUserSessions(userId: string): Promise<void> {
    for (const [id, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(id);
      }
    }
  }

  expireSessionsForUser(userId: string): void {
    const past = new Date(Date.now() - 60_000);
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        session.expiresAt = past;
      }
    }
  }

  idleExpireSessionsForUser(userId: string, idleTimeoutMs: number): void {
    const past = new Date(Date.now() - idleTimeoutMs - 60_000);
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        session.lastActiveAt = past;
      }
    }
  }
}

function extractCookiePair(setCookieHeader: string | string[] | undefined): string {
  const first = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  if (!first) {
    throw new Error('Expected Set-Cookie header to be present');
  }
  return first.split(';')[0] ?? '';
}

describe('AuthService Authentication & Authorization (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: InMemoryUsersRepository;
  let sessionStore: InMemorySessionStore;
  let passwordHasher: PasswordHasher;

  beforeAll(async () => {
    passwordHasher = new PasswordHasher({ logN: 10 });
    usersRepository = new InMemoryUsersRepository();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(UsersRepository)
      .useValue(usersRepository)
      .overrideProvider(DrizzleSessionStore)
      .useFactory({
        factory: (storage: AuthenticationStorage) =>
          new InMemorySessionStore(storage, usersRepository),
        inject: [AuthenticationStorage],
      })
      .overrideProvider(PasswordHasher)
      .useValue(passwordHasher)
      .compile();

    app = moduleFixture.createNestApplication();
    configureAuthApp(app);
    await app.init();

    sessionStore = app.get(DrizzleSessionStore);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('public health & root endpoints', () => {
    it('GET / returns Hello World!', () => {
      return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
    });

    it('GET /health returns ServiceName.AUTH_SERVICE health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            service: ServiceName.AUTH_SERVICE,
            status: 'ok',
            timestamp: expect.any(String),
          });
        });
    });
  });

  describe('authentication flows', () => {
    it('registers a customer, sets an HttpOnly session cookie, and rejects duplicate email', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'Alice@Example.com', password: 'StrongPassword1!' })
        .expect(201);

      expect(registerRes.body).toEqual({
        id: expect.any(String),
        email: 'alice@example.com',
        role: UserRole.CUSTOMER,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(registerRes.body).not.toHaveProperty('passwordHash');

      const setCookie = registerRes.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const rawSetCookie = Array.isArray(setCookie) ? setCookie[0] : String(setCookie);
      expect(rawSetCookie).toContain('HttpOnly');
      expect(rawSetCookie).toContain('SameSite=Lax');

      const cookiePair = extractCookiePair(setCookie);
      const rawToken = cookiePair.split('=')[1] ?? '';
      expect(rawToken.length).toBeGreaterThan(20);
      expect(sessionStore.sessions.has(rawToken)).toBe(false);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookiePair)
        .expect(200)
        .expect((res) => {
          expect(res.body.email).toBe('alice@example.com');
          expect(res.body.role).toBe(UserRole.CUSTOMER);
        });

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'alice@example.com', password: 'AnotherPassword1!' })
        .expect(409);
    });

    it('rejects weak passwords and role escalation during registration', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'weak@example.com', password: 'short' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'escalate@example.com',
          password: 'StrongPassword1!',
          role: UserRole.ADMIN,
        })
        .expect(400);
    });

    it('authenticates with valid credentials, rotates session on login, and invalidates on logout', async () => {
      const passwordHash = await passwordHasher.hash('ValidPass123!');
      await usersRepository.create('bob@example.com', {
        passwordHash,
        role: UserRole.CUSTOMER,
      });

      const firstLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'bob@example.com', password: 'ValidPass123!' })
        .expect(200);

      const firstCookie = extractCookiePair(firstLogin.headers['set-cookie']);

      const secondLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Cookie', firstCookie)
        .send({ email: 'bob@example.com', password: 'ValidPass123!' })
        .expect(200);

      const rotatedCookie = extractCookiePair(secondLogin.headers['set-cookie']);
      expect(rotatedCookie).not.toBe(firstCookie);

      await request(app.getHttpServer()).get('/auth/me').set('Cookie', firstCookie).expect(401);
      await request(app.getHttpServer()).get('/auth/me').set('Cookie', rotatedCookie).expect(200);

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', rotatedCookie)
        .expect(200)
        .expect({ success: true });

      await request(app.getHttpServer()).get('/auth/me').set('Cookie', rotatedCookie).expect(401);
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });

    it('returns generic 401 on wrong credentials and rate-limits repeated failed attempts', async () => {
      const passwordHash = await passwordHasher.hash('ValidPass123!');
      await usersRepository.create('ratelimit@example.com', {
        passwordHash,
        role: UserRole.CUSTOMER,
      });

      const unknownEmailRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'unknown-user@example.com', password: 'WrongPassword1!' })
        .expect(401);

      const wrongPassRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ratelimit@example.com', password: 'WrongPassword1!' })
        .expect(401);

      expect(unknownEmailRes.body.message).toBe('Invalid email or password');
      expect(wrongPassRes.body.message).toBe('Invalid email or password');

      for (let i = 0; i < 4; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'ratelimit@example.com', password: 'WrongPassword1!' })
          .expect(401);
      }

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ratelimit@example.com', password: 'ValidPass123!' })
        .expect(429);
    });

    it('rejects unauthenticated access and expired or idle sessions', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);

      const passwordHash = await passwordHasher.hash('ValidPass123!');
      const user = await usersRepository.create('expiry@example.com', {
        passwordHash,
        role: UserRole.CUSTOMER,
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'expiry@example.com', password: 'ValidPass123!' })
        .expect(200);
      const cookie = extractCookiePair(loginRes.headers['set-cookie']);

      sessionStore.expireSessionsForUser(user.id);
      await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie).expect(401);

      const secondLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'expiry@example.com', password: 'ValidPass123!' })
        .expect(200);
      const secondCookie = extractCookiePair(secondLogin.headers['set-cookie']);

      sessionStore.idleExpireSessionsForUser(user.id, 30 * 60 * 1000);
      await request(app.getHttpServer()).get('/auth/me').set('Cookie', secondCookie).expect(401);
    });
  });

  describe('authorization and CSRF protection', () => {
    it('enforces customer ownership, role restrictions, and admin access', async () => {
      const passwordHash = await passwordHasher.hash('ValidPass123!');
      const customerA = await usersRepository.create('cust-a@example.com', {
        passwordHash,
        role: UserRole.CUSTOMER,
      });
      const customerB = await usersRepository.create('cust-b@example.com', {
        passwordHash,
        role: UserRole.CUSTOMER,
      });
      await usersRepository.create('admin@example.com', {
        passwordHash,
        role: UserRole.ADMIN,
      });

      const loginA = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'cust-a@example.com', password: 'ValidPass123!' })
        .expect(200);
      const cookieA = extractCookiePair(loginA.headers['set-cookie']);

      const loginAdmin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@example.com', password: 'ValidPass123!' })
        .expect(200);
      const adminCookie = extractCookiePair(loginAdmin.headers['set-cookie']);

      await request(app.getHttpServer())
        .get(`/users/${customerA.id}`)
        .set('Cookie', cookieA)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(customerA.id);
        });

      await request(app.getHttpServer())
        .patch(`/users/${customerA.id}`)
        .set('Cookie', cookieA)
        .send({ email: 'cust-a-updated@example.com' })
        .expect(200)
        .expect((res) => {
          expect(res.body.email).toBe('cust-a-updated@example.com');
        });

      await request(app.getHttpServer())
        .patch(`/users/${customerA.id}`)
        .set('Cookie', cookieA)
        .send({ role: UserRole.ADMIN })
        .expect(400);

      await request(app.getHttpServer())
        .get(`/users/${customerB.id}`)
        .set('Cookie', cookieA)
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/users/${customerB.id}`)
        .set('Cookie', cookieA)
        .send({ email: 'hijacked@example.com' })
        .expect(403);

      await request(app.getHttpServer()).get('/admin/users').set('Cookie', cookieA).expect(403);
      await request(app.getHttpServer()).get('/admin/users').expect(401);

      await request(app.getHttpServer())
        .get('/admin/users')
        .set('Cookie', adminCookie)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(3);
        });

      await request(app.getHttpServer())
        .get(`/users/${customerB.id}`)
        .set('Cookie', adminCookie)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/admin/users/${customerA.id}/sessions`)
        .set('Cookie', adminCookie)
        .expect(200)
        .expect({ revokedCount: 1 });

      await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookieA).expect(401);
    });

    it('blocks cross-site and untrusted-origin state-changing requests via enableCsrfProtection', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Sec-Fetch-Site', 'cross-site')
        .set('Origin', 'https://evil.example.com')
        .send({ email: 'cust-b@example.com', password: 'ValidPass123!' })
        .expect(403);

      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Origin', 'https://evil.example.com')
        .send({ email: 'cust-b@example.com', password: 'ValidPass123!' })
        .expect(403);
    });
  });
});
