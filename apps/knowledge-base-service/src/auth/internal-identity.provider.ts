import { Injectable, Optional } from '@nestjs/common';
import { AuthenticationRegistry } from '@nestjs/authentication';
import {
  BaseInternalIdentityAuth,
  ConfigService,
  createValidatedConfigService,
} from '@semcache/shared-config';
import { type KnowledgeBaseEnv, knowledgeBaseEnvSchema } from '../config/knowledge-base.env';

@Injectable()
export class InternalIdentityAuth extends BaseInternalIdentityAuth {
  constructor(
    registry: AuthenticationRegistry,
    @Optional()
    configService: ConfigService<KnowledgeBaseEnv, true> = createValidatedConfigService(
      knowledgeBaseEnvSchema,
    ),
  ) {
    super(configService, registry, InternalIdentityAuth.name);
  }
}
