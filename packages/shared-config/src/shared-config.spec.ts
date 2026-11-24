import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { ServiceName } from '@semcache/shared-types';
import {
  ConfigService,
  SharedConfigModule,
  baseEnvSchema,
  checkDatabaseUrl,
  checkInternalSecret,
  createValidatedConfigService,
  defaultString,
  durationEnvSchema,
  isTestSecurityBypassEnabled,
  optionalString,
  positiveInt,
  resolveEnvFilePaths,
  resolveSecretFromConfig,
  resolveServiceTcpEndpoint,
} from './index';

const testServiceEnvSchema = baseEnvSchema
  .extend({
    DATABASE_URL: defaultString(''),
    INTERNAL_SERVICE_SECRET: defaultString(''),
    AUTH_SERVICE_HOST: optionalString(),
    AUTH_SERVICE_PORT: positiveInt('AUTH_SERVICE_PORT').optional(),
    AUTH_SERVICE_URL: optionalString(),
    REQUEST_TIMEOUT_MS: positiveInt('REQUEST_TIMEOUT_MS').default(5000),
    SESSION_TTL: durationEnvSchema('SESSION_TTL', '24h'),
  })
  .superRefine((data, ctx) => {
    checkDatabaseUrl(data, ctx);
    checkInternalSecret(data, ctx);
  });

describe('SharedConfigModule & Environment Validation', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('registers ConfigService globally and serves coerced/validated values', async () => {
    process.env.NODE_ENV = 'test';
    process.env.REQUEST_TIMEOUT_MS = '240000';
    process.env.SESSION_TTL = '12h';

    const moduleRef = await Test.createTestingModule({
      imports: [SharedConfigModule.forRoot(testServiceEnvSchema)],
    }).compile();

    const configService = moduleRef.get(ConfigService);
    expect(configService.get('NODE_ENV')).toBe('test');
    expect(configService.get<number>('REQUEST_TIMEOUT_MS')).toBe(240_000);
    expect(configService.get<string>('SESSION_TTL')).toBe('12h');

    await moduleRef.close();
  });

  it('aborts early on the first invalid env variable when compiling a Nest module', async () => {
    process.env.NODE_ENV = 'test';
    process.env.REQUEST_TIMEOUT_MS = '0';

    await expect(
      Test.createTestingModule({
        imports: [SharedConfigModule.forRoot(testServiceEnvSchema)],
      }).compile(),
    ).rejects.toThrow(/REQUEST_TIMEOUT_MS must be a positive integer/);
  });

  it('aborts early on missing DATABASE_URL outside test mode and short secrets', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DATABASE_URL;

    expect(() =>
      createValidatedConfigService(testServiceEnvSchema, { loadEnvFiles: false }),
    ).toThrow(/Missing required environment variable: DATABASE_URL/);

    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.INTERNAL_SERVICE_SECRET = 'too-short';

    expect(() =>
      createValidatedConfigService(testServiceEnvSchema, { loadEnvFiles: false }),
    ).toThrow(/INTERNAL_SERVICE_SECRET must be at least 32 characters long/);
  });

  it('resolves TCP endpoints and secrets from ConfigService', () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_SERVICE_URL = 'tcp://auth-host:3101';
    delete process.env.AUTH_SERVICE_HOST;
    delete process.env.AUTH_SERVICE_PORT;
    delete process.env.INTERNAL_SERVICE_SECRET;

    const configService = createValidatedConfigService(testServiceEnvSchema, {
      loadEnvFiles: false,
    });
    const endpoint = resolveServiceTcpEndpoint(configService, ServiceName.AUTH_SERVICE, {
      hostKey: 'AUTH_SERVICE_HOST',
      portKey: 'AUTH_SERVICE_PORT',
      urlKey: 'AUTH_SERVICE_URL',
    });

    expect(endpoint).toEqual({ host: 'auth-host', port: 3101 });

    const secret = resolveSecretFromConfig(configService, 'INTERNAL_SERVICE_SECRET', 'test');
    expect(secret).toHaveLength(64);
  });

  it('resolves local .env first, packages/shared-config/.env.backend second, and ignores root .env', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'semcache-env-test-'));
    try {
      const appDir = join(rootDir, 'apps', 'sample-app');
      const sharedConfigDir = join(rootDir, 'packages', 'shared-config');
      mkdirSync(appDir, { recursive: true });
      mkdirSync(sharedConfigDir, { recursive: true });
      writeFileSync(join(rootDir, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n');
      writeFileSync(join(rootDir, '.env'), 'ROOT_VAR=should_not_load\n');

      expect(resolveEnvFilePaths(appDir)).toEqual([]);

      const sharedEnvPath = join(sharedConfigDir, '.env.backend');
      writeFileSync(sharedEnvPath, 'INTERNAL_SERVICE_SECRET=shared-secret\n');
      expect(resolveEnvFilePaths(appDir)).toEqual([sharedEnvPath]);

      const localEnvPath = join(appDir, '.env');
      writeFileSync(localEnvPath, 'LOCAL_VAR=ok\n');
      expect(resolveEnvFilePaths(appDir)).toEqual([localEnvPath, sharedEnvPath]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('enables test security bypass strictly when NODE_ENV=test', () => {
    expect(isTestSecurityBypassEnabled('production', true)).toBe(false);
    expect(isTestSecurityBypassEnabled('development', true)).toBe(false);
    expect(isTestSecurityBypassEnabled('test', true)).toBe(true);
    expect(isTestSecurityBypassEnabled('test', false)).toBe(false);

    // Inside Jest (`JEST_WORKER_ID` is defined), unset flag keeps security checks active
    expect(isTestSecurityBypassEnabled('test', undefined)).toBe(false);

    const prevWorkerId = process.env.JEST_WORKER_ID;
    delete process.env.JEST_WORKER_ID;
    try {
      expect(isTestSecurityBypassEnabled('test', undefined)).toBe(true);
    } finally {
      if (prevWorkerId !== undefined) {
        process.env.JEST_WORKER_ID = prevWorkerId;
      }
    }
  });
});
