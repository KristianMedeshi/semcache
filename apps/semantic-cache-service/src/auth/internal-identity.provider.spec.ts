import { AuthenticationRegistry } from '@nestjs/authentication';
import { ConfigService } from '@semcache/shared-config';
import type { SemanticCacheEnv } from '../config/semantic-cache.env';
import { InternalIdentityAuth } from './internal-identity.provider';

describe('SemanticCache InternalIdentityAuth', () => {
  it('registers itself with AuthenticationRegistry using SemanticCacheEnv config', () => {
    const registry = new AuthenticationRegistry();
    const configService = new ConfigService<SemanticCacheEnv, true>({
      NODE_ENV: 'test',
      INTERNAL_SERVICE_SECRET: 'test-internal-service-secret-32-chars!!',
    });
    const provider = new InternalIdentityAuth(registry, configService);

    expect(registry.providers).toContain(provider);
  });
});
