import { randomUUID } from 'node:crypto';
import type { AddressInfo, Server } from 'node:net';
import { type INestMicroservice, Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  PasswordHasher,
  type SessionRecord,
  type SessionStore,
} from '@nestjs/authentication';
import {
  ClientProxy,
  ClientProxyFactory,
  type MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';
import { Test, type TestingModule } from '@nestjs/testing';
import { extractRpcErrorPayload } from '@semcache/shared-config';
import type {
  AuthTcpResponseDto,
  LogoutResponseDto,
  RevokeUserSessionsResponseDto,
  UserResponseDto,
} from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS, ServiceName, UserRole } from '@semcache/shared-types';
import { firstValueFrom } from 'rxjs';
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

function extractCookiePair(setCookieHeader: string | undefined): string {
  if (!setCookieHeader) {
    throw new Error('Expected setCookie string to be present');
  }
  return setCookieHeader.split(';')[0] ?? '';
}

async function sendRpcExpectingError(
  client: ClientProxy,
  pattern: string,
  payload: unknown,
  expectedStatus: number,
) {
  let caughtError: unknown;
  try {
    await firstValueFrom(client.send(pattern, payload));
  } catch (error) {
    caughtError = error;
  }
  const rpcError = extractRpcErrorPayload(caughtError);
  expect(rpcError?.statusCode).toBe(expectedStatus);
  return rpcError;
}

describe('AuthService Authentication & Authorization (TCP e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
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

    app = moduleFixture.createNestMicroservice<MicroserviceOptions>({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 0 },
    });
    await app.listen();

    const address = app.unwrap<Server>().address() as AddressInfo;
    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: address.port },
    });
    await client.connect();

    sessionStore = app.get(DrizzleSessionStore);
  });

  afterAll(async () => {
    await client.close();
    await app.close();
  });

  describe('public health & root patterns', () => {
    it('app.hello returns Hello World!', async () => {
      const res = await firstValueFrom(client.send(SERVICE_TCP_PATTERNS.APP_HELLO, {}));
      expect(res).toBe('Hello World!');
    });

    it('app.health returns ServiceName.AUTH_SERVICE health status', async () => {
      const res = await firstValueFrom(client.send(SERVICE_TCP_PATTERNS.APP_HEALTH, {}));
      expect(res).toEqual({
        service: ServiceName.AUTH_SERVICE,
        status: 'ok',
        timestamp: expect.any(String),
      });
    });
  });

  describe('authentication flows', () => {
    it('registers a customer, sets an HttpOnly session cookie, and rejects duplicate email', async () => {
      const registerRes = await firstValueFrom(
        client.send<AuthTcpResponseDto<UserResponseDto>>(SERVICE_TCP_PATTERNS.AUTH_REGISTER, {
          body: { email: 'Alice@Example.com', password: 'StrongPassword1!' },
          method: 'POST',
        }),
      );

      expect(registerRes.data).toEqual({
        id: expect.any(String),
        email: 'alice@example.com',
        role: UserRole.CUSTOMER,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(registerRes.data).not.toHaveProperty('passwordHash');

      expect(registerRes.setCookie).toBeDefined();
      expect(registerRes.setCookie).toContain('HttpOnly');
      expect(registerRes.setCookie).toContain('SameSite=Lax');

      const cookiePair = extractCookiePair(registerRes.setCookie);
      const rawToken = cookiePair.split('=')[1] ?? '';
      expect(rawToken.length).toBeGreaterThan(20);
      expect(sessionStore.sessions.has(rawToken)).toBe(false);

      const meRes = await firstValueFrom(
        client.send<UserResponseDto>(SERVICE_TCP_PATTERNS.AUTH_ME, {
          headers: { cookie: cookiePair },
          method: 'GET',
        }),
      );
      expect(meRes.email).toBe('alice@example.com');
      expect(meRes.role).toBe(UserRole.CUSTOMER);

      await sendRpcExpectingError(
        client,
        SERVICE_TCP_PATTERNS.AUTH_REGISTER,
        {
          body: { email: 'alice@example.com', password: 'AnotherPassword1!' },
          method: 'POST',
        },
        409,
      );
    });

    it('rejects weak passwords and role escalation during registration', async () => {
      await sendRpcExpectingError(
        client,
        SERVICE_TCP_PATTERNS.AUTH_REGISTER,
        { body: { email: 'weak@example.com', password: 'short' }, method: 'POST' },
        400,
      );

      await sendRpcExpectingError(
        client,
        SERVICE_TCP_PATTERNS.AUTH_REGISTER,
        {
          body: {
            email: 'escalate@example.com',
            password: 'StrongPassword1!',
            role: UserRole.ADMIN,
          },
          method: 'POST',
        },
        400,
      );
    });

    it('authenticates with valid credentials, rotates session on login, and invalidates on logout', async () => {
      const passwordHash = await passwordHasher.hash('ValidPass123!');
      await usersRepository.create('bob@example.com', {
        passwordHash,
        role: UserRole.CUSTOMER,
      });

      const firstLogin = await firstValueFrom(
        client.send<AuthTcpResponseDto<UserResponseDto>>(SERVICE_TCP_PATTERNS.AUTH_LOGIN, {
          body: { email: 'bob@example.com', password: 'ValidPass123!' },
          method: 'POST',
        }),
      );
      const firstCookie = extractCookiePair(firstLogin.setCookie);

      const secondLogin = await firstValueFrom(
        client.send<AuthTcpResponseDto<UserResponseDto>>(SERVICE_TCP_PATTERNS.AUTH_LOGIN, {
          headers: { cookie: firstCookie },
          body: { email: 'bob@example.com', password: 'ValidPass123!' },
          method: 'POST',
        }),
      );
      const rotatedCookie = extractCookiePair(secondLogin.setCookie);
      expect(rotatedCookie).not.toBe(firstCookie);

      await sendRpcExpectingError(
        client,
        SERVICE_TCP_PATTERNS.AUTH_ME,
        { headers: { cookie: firstCookie }, method: 'GET' },
        401,
      );

      await firstValueFrom(
        client.send(SERVICE_TCP_PATTERNS.AUTH_ME, {
          headers: { cookie: rotatedCookie },
          method: 'GET',
        }),
      );

      const logoutRes = await firstValueFrom(
        client.send<AuthTcpResponseDto<LogoutResponseDto>>(SERVICE_TCP_PATTERNS.AUTH_LOGOUT, {
          headers: { cookie: rotatedCookie },
          method: 'POST',
        }),
      );
      expect(logoutRes.data).toEqual({ success: true });

      await sendRpcExpectingError(
        client,
        SERVICE_TCP_PATTERNS.AUTH_ME,
        { headers: { cookie: rotatedCookie }, method: 'GET' },
        401,
      );
      await sendRpcExpectingError(
        client,
        SERVICE_TCP_PATTERNS.AUTH_LOGOUT,
        { method: 'POST' },
        401,
      );
    });

    it('returns generic 401 on wrong credentials and rate-limits repeated failed attempts', async () => {
      const passwordHash = await passwordHasher.hash('ValidPass123!');
      await usersRepository.create('ratelimit@example.com', {
        passwordHash,
        role: UserRole.CUSTOMER,
      });

      const unknownEmailErr = await sendRpcExpectingError(
        client,
        SERVICE_TCP_PATTERNS.AUTH_LOGIN,
        {
          body: { email: 'unknown-user@example.com', password: 'WrongPassword1!' },
          method: 'POST',
        },
        401,
      );

      const wrongPassErr = await sendRpcExpectingError(
        client,
        SERVICE_TCP_PATTERNS.AUTH_LOGIN,
        {
          body: { email: 'ratelimit@example.com', password: 'WrongPassword1!' },
          method: 'POST',
        },
        401,
      );

      expect(unknownEmailErr?.message).toBe('Invalid email or password');
      expect(wrongPassErr?.message).toBe('Invalid email or password');

      for (let i = 0; i < 4; i++) {
        await sendRpcExpectingError(
          client,
          SERVICE_TCP_PATTERNS.AUTH_LOGIN,
          {
            body: { email: 'ratelimit@example.com', password: 'WrongPassword1!' },
            method: 'POST',
          },
          401,
        );
      }

      await sendRpcExpectingError(
        client,
        SERVICE_TCP_PATTERNS.AUTH_LOGIN,
        {
          body: { email: 'ratelimit@example.com', password: 'ValidPass123!' },
          method: 'POST',
        },
        429,
      );
    });

    it('rejects unauthenticated access and expired or idle sessions', async () => {
      await sendRpcExpectingError(client, SERVICE_TCP_PATTERNS.AUTH_ME, { method: 'GET' }, 401);

      const passwordHash = await passwordHasher.hash('ValidPass123!');
      const user = await usersRepository.create('expiry@example.com', {
        passwordHash,
        role: UserRole.CUSTOMER,
      });

      const loginRes = await firstValueFrom(
        client.send<AuthTcpResponseDto<UserResponseDto>>(SERVICE_TCP_PATTERNS.AUTH_LOGIN, {
          body: { email: 'expiry@example.com', password: 'ValidPass123!' },
          method: 'POST',
        }),
      );
      const cookie = extractCookiePair(loginRes.setCookie);

      sessionStore.expireSessionsForUser(user.id);
      await sendRpcExpectingError(
        client,
        SERVICE_TCP_PATTERNS.AUTH_ME,
        { headers: { cookie }, method: 'GET' },
        401,
      );

      const secondLogin = await firstValueFrom(
        client.send<AuthTcpResponseDto<UserResponseDto>>(SERVICE_TCP_PATTERNS.AUTH_LOGIN, {
          body: { email: 'expiry@example.com', password: 'ValidPass123!' },
          method: 'POST',
        }),
      );
      const secondCookie = extractCookiePair(secondLogin.setCookie);

      sessionStore.idleExpireSessionsForUser(user.id, 30 * 60 * 1000);
      await sendRpcExpectingError(
        client,
        SERVICE_TCP_PATTERNS.AUTH_ME,
        { headers: { cookie: secondCookie }, method: 'GET' },
        401,
      );
    });
  });

  describe('authorization and CSRF origin protection', () => {
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

      const loginA = await firstValueFrom(
        client.send<AuthTcpResponseDto<UserResponseDto>>(SERVICE_TCP_PATTERNS.AUTH_LOGIN, {
          body: { email: 'cust-a@example.com', password: 'ValidPass123!' },
          method: 'POST',
        }),
      );
      const cookieA = extractCookiePair(loginA.setCookie);

      const loginAdmin = await firstValueFrom(
        client.send<AuthTcpResponseDto<UserResponseDto>>(SERVICE_TCP_PATTERNS.AUTH_LOGIN, {
          body: { email: 'admin@example.com', password: 'ValidPass123!' },
          method: 'POST',
        }),
      );
      const adminCookie = extractCookiePair(loginAdmin.setCookie);

      const fetchedA = await firstValueFrom(
        client.send<UserResponseDto>(SERVICE_TCP_PATTERNS.USERS_GET, {
          id: customerA.id,
          headers: { cookie: cookieA },
          method: 'GET',
        }),
      );
      expect(fetchedA.id).toBe(customerA.id);

      const updatedA = await firstValueFrom(
        client.send<AuthTcpResponseDto<UserResponseDto>>(SERVICE_TCP_PATTERNS.USERS_UPDATE, {
          id: customerA.id,
          headers: { cookie: cookieA },
          body: { email: 'cust-a-updated@example.com' },
          method: 'PATCH',
        }),
      );
      expect(updatedA.data.email).toBe('cust-a-updated@example.com');

      await sendRpcExpectingError(
        client,
        SERVICE_TCP_PATTERNS.USERS_UPDATE,
        {
          id: customerA.id,
          headers: { cookie: cookieA },
          body: { role: UserRole.ADMIN },
          method: 'PATCH',
        },
        400,
      );

      await sendRpcExpectingError(
        client,
        SERVICE_TCP_PATTERNS.USERS_GET,
        {
          id: customerB.id,
          headers: { cookie: cookieA },
          method: 'GET',
        },
        403,
      );

      await sendRpcExpectingError(
        client,
        SERVICE_TCP_PATTERNS.USERS_UPDATE,
        {
          id: customerB.id,
          headers: { cookie: cookieA },
          body: { email: 'hijacked@example.com' },
          method: 'PATCH',
        },
        403,
      );

      await sendRpcExpectingError(
        client,
        SERVICE_TCP_PATTERNS.ADMIN_USERS_LIST,
        { headers: { cookie: cookieA }, method: 'GET' },
        403,
      );

      await sendRpcExpectingError(
        client,
        SERVICE_TCP_PATTERNS.ADMIN_USERS_LIST,
        { method: 'GET' },
        401,
      );

      const allUsers = await firstValueFrom(
        client.send<UserResponseDto[]>(SERVICE_TCP_PATTERNS.ADMIN_USERS_LIST, {
          headers: { cookie: adminCookie },
          method: 'GET',
        }),
      );
      expect(Array.isArray(allUsers)).toBe(true);
      expect(allUsers.length).toBeGreaterThanOrEqual(3);

      await firstValueFrom(
        client.send<UserResponseDto>(SERVICE_TCP_PATTERNS.USERS_GET, {
          id: customerB.id,
          headers: { cookie: adminCookie },
          method: 'GET',
        }),
      );

      const revokeRes = await firstValueFrom(
        client.send<RevokeUserSessionsResponseDto>(
          SERVICE_TCP_PATTERNS.ADMIN_USERS_REVOKE_SESSIONS,
          {
            id: customerA.id,
            headers: { cookie: adminCookie },
            method: 'DELETE',
          },
        ),
      );
      expect(revokeRes).toEqual({ revokedCount: 1 });

      await sendRpcExpectingError(
        client,
        SERVICE_TCP_PATTERNS.AUTH_ME,
        { headers: { cookie: cookieA }, method: 'GET' },
        401,
      );
    });

    it('blocks cross-site and untrusted-origin state-changing requests', async () => {
      await sendRpcExpectingError(
        client,
        SERVICE_TCP_PATTERNS.AUTH_LOGIN,
        {
          headers: {
            'sec-fetch-site': 'cross-site',
            origin: 'https://evil.example.com',
          },
          body: { email: 'cust-b@example.com', password: 'ValidPass123!' },
          method: 'POST',
        },
        403,
      );

      await sendRpcExpectingError(
        client,
        SERVICE_TCP_PATTERNS.AUTH_LOGIN,
        {
          headers: {
            origin: 'https://evil.example.com',
          },
          body: { email: 'cust-b@example.com', password: 'ValidPass123!' },
          method: 'POST',
        },
        403,
      );
    });
  });
});
