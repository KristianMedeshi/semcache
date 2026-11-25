import { AuthenticationRegistry } from '@nestjs/authentication';
import { createValidatedConfigService } from '@semcache/shared-config';
import { llmEnvSchema } from '../config/llm.env';
import { InternalIdentityAuth } from './internal-identity.provider';

describe('LLM InternalIdentityAuth', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('registers itself with AuthenticationRegistry using LlmEnv config', () => {
    process.env.NODE_ENV = 'test';
    process.env.INTERNAL_SERVICE_SECRET = 'test-internal-service-secret-32-chars!!';
    const registry = new AuthenticationRegistry();
    const config = createValidatedConfigService(llmEnvSchema, { loadEnvFiles: false });
    const provider = new InternalIdentityAuth(config, registry);

    expect(registry.providers).toContain(provider);
  });
});
