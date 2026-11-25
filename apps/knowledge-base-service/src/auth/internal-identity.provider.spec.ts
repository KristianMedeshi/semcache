import { AuthenticationRegistry } from '@nestjs/authentication';
import { ConfigService } from '@semcache/shared-config';
import type { KnowledgeBaseEnv } from '../config/knowledge-base.env';
import { InternalIdentityAuth } from './internal-identity.provider';

describe('KnowledgeBase InternalIdentityAuth', () => {
  it('registers itself with AuthenticationRegistry using KnowledgeBaseEnv config', () => {
    const registry = new AuthenticationRegistry();
    const configService = new ConfigService<KnowledgeBaseEnv, true>({
      NODE_ENV: 'test',
      INTERNAL_SERVICE_SECRET: 'test-internal-service-secret-32-chars!!',
    });
    const provider = new InternalIdentityAuth(registry, configService);

    expect(registry.providers).toContain(provider);
  });
});
