import { Injectable, Optional } from '@nestjs/common';
import { AuthenticationRegistry } from '@nestjs/authentication';
import {
  BaseInternalIdentityAuth,
  ConfigService,
  createValidatedConfigService,
} from '@semcache/shared-config';
import { type SemanticCacheEnv, semanticCacheEnvSchema } from '../config/semantic-cache.env';

@Injectable()
export class InternalIdentityAuth extends BaseInternalIdentityAuth {
  constructor(
    registry: AuthenticationRegistry,
    @Optional()
    configService: ConfigService<SemanticCacheEnv, true> = createValidatedConfigService(
      semanticCacheEnvSchema,
    ),
  ) {
    super(configService, registry, InternalIdentityAuth.name);
  }
}
