import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_SERVICE_PORTS,
  type NodeEnvironment,
  getNodeEnv,
  getOptionalEnv,
  getRequiredEnv,
  resolveSecretEnv,
} from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';

@Injectable()
export class DialogConfigService {
  private readonly logger = new Logger(DialogConfigService.name);

  readonly nodeEnv: NodeEnvironment;
  readonly databaseUrl: string;
  readonly llmServiceUrl: string;
  readonly internalServiceSecret: string;

  constructor() {
    this.nodeEnv = getNodeEnv();
    this.databaseUrl =
      this.nodeEnv === 'test' ? getOptionalEnv('DATABASE_URL', '') : getRequiredEnv('DATABASE_URL');

    const defaultLlmUrl = `http://localhost:${DEFAULT_SERVICE_PORTS[ServiceName.LLM_SERVICE]}`;
    this.llmServiceUrl = getOptionalEnv('LLM_SERVICE_URL', defaultLlmUrl).replace(/\/+$/, '');
    this.internalServiceSecret = resolveSecretEnv('INTERNAL_SERVICE_SECRET', this.nodeEnv, (msg) =>
      this.logger.warn(msg),
    );
  }
}
