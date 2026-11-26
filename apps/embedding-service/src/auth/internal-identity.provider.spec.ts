import { AuthenticationRegistry } from '@nestjs/authentication';
import { createValidatedConfigService } from '@semcache/shared-config';
import { embeddingEnvSchema } from '../config/embedding.env';
import { InternalIdentityAuth } from './internal-identity.provider';

describe('Embedding InternalIdentityAuth', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('registers itself with AuthenticationRegistry using EmbeddingEnv config', () => {
    process.env.NODE_ENV = 'test';
    process.env.INTERNAL_SERVICE_SECRET = 'test-internal-service-secret-32-chars!!';
    const registry = new AuthenticationRegistry();
    const config = createValidatedConfigService(embeddingEnvSchema, { loadEnvFiles: false });
    const provider = new InternalIdentityAuth(config, registry);

    expect(registry.providers).toContain(provider);
  });
});
