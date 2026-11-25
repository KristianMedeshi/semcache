import { Injectable } from '@nestjs/common';
import { AuthenticationRegistry } from '@nestjs/authentication';
import { BaseInternalIdentityAuth, ConfigService } from '@semcache/shared-config';
import type { LlmEnv } from '../config/llm.env';

@Injectable()
export class InternalIdentityAuth extends BaseInternalIdentityAuth {
  constructor(config: ConfigService<LlmEnv, true>, registry: AuthenticationRegistry) {
    super(config, registry, InternalIdentityAuth.name);
  }
}
