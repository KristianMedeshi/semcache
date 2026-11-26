import { Injectable } from '@nestjs/common';
import { AuthenticationRegistry } from '@nestjs/authentication';
import { BaseInternalIdentityAuth, ConfigService } from '@semcache/shared-config';
import type { EmbeddingEnv } from '../config/embedding.env';

@Injectable()
export class InternalIdentityAuth extends BaseInternalIdentityAuth {
  constructor(config: ConfigService<EmbeddingEnv, true>, registry: AuthenticationRegistry) {
    super(config, registry, InternalIdentityAuth.name);
  }
}
