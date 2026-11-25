import { Injectable } from '@nestjs/common';
import { AuthenticationRegistry } from '@nestjs/authentication';
import { BaseInternalIdentityAuth, ConfigService } from '@semcache/shared-config';
import type { DialogEnv } from '../config/dialog.env';

@Injectable()
export class InternalIdentityAuth extends BaseInternalIdentityAuth {
  constructor(config: ConfigService<DialogEnv, true>, registry: AuthenticationRegistry) {
    super(config, registry, InternalIdentityAuth.name);
  }
}
