import { Test } from '@nestjs/testing';
import { ServiceName } from '@semcache/shared-types';
import {
  ConfigService,
  SharedConfigModule,
  authEnvSchema,
  createValidatedConfigService,
  gatewayEnvSchema,
  llmEnvSchema,
  resolveSecretFromConfig,
  resolveServiceTcpEndpoint,
} from './index';

describe('SharedConfigModule & Environment Validation', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('registers ConfigService globally and serves coerced/validated values', async () => {
    process.env.NODE_ENV = 'test';
    process.env.OPENROUTER_TIMEOUT_MS = '240000';
    process.env.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/';
    process.env.OPENROUTER_DEFAULT_MODEL = 'openrouter/free';

    const moduleRef = await Test.createTestingModule({
      imports: [SharedConfigModule.forRoot(llmEnvSchema)],
    }).compile();

    const configService = moduleRef.get(ConfigService);
    expect(configService.get('NODE_ENV')).toBe('test');
    expect(configService.get<number>('OPENROUTER_TIMEOUT_MS')).toBe(240_000);
    expect(configService.get<string>('OPENROUTER_BASE_URL')).toBe('https://openrouter.ai/api/v1');
    expect(configService.get<string>('OPENROUTER_DEFAULT_MODEL')).toBe('openrouter/free');

    await moduleRef.close();
  });

  it('aborts early on the first invalid env variable when compiling a Nest module', async () => {
    process.env.NODE_ENV = 'test';
    process.env.OPENROUTER_TIMEOUT_MS = '0';

    await expect(
      Test.createTestingModule({
        imports: [SharedConfigModule.forRoot(llmEnvSchema)],
      }).compile(),
    ).rejects.toThrow(/OPENROUTER_TIMEOUT_MS must be a positive integer/);
  });

  it('aborts early on missing DATABASE_URL outside test mode and short secrets', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DATABASE_URL;

    expect(() => createValidatedConfigService(authEnvSchema, { loadEnvFiles: false })).toThrow(
      /Missing required environment variable: DATABASE_URL/,
    );

    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.INTERNAL_SERVICE_SECRET = 'too-short';

    expect(() => createValidatedConfigService(authEnvSchema, { loadEnvFiles: false })).toThrow(
      /INTERNAL_SERVICE_SECRET must be at least 32 characters long/,
    );
  });

  it('resolves TCP endpoints and secrets from ConfigService', () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_SERVICE_URL = 'tcp://auth-host:3101';
    delete process.env.AUTH_SERVICE_HOST;
    delete process.env.AUTH_SERVICE_PORT;
    delete process.env.INTERNAL_SERVICE_SECRET;

    const configService = createValidatedConfigService(gatewayEnvSchema, { loadEnvFiles: false });
    const endpoint = resolveServiceTcpEndpoint(configService, ServiceName.AUTH_SERVICE, {
      hostKey: 'AUTH_SERVICE_HOST',
      portKey: 'AUTH_SERVICE_PORT',
      urlKey: 'AUTH_SERVICE_URL',
    });

    expect(endpoint).toEqual({ host: 'auth-host', port: 3101 });

    const secret = resolveSecretFromConfig(configService, 'INTERNAL_SERVICE_SECRET', 'test');
    expect(secret).toHaveLength(64);
  });
});
