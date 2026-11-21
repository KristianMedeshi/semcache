import { Injectable, Logger } from '@nestjs/common';
import {
  type NodeEnvironment,
  getNodeEnv,
  getOptionalEnv,
  getRequiredEnv,
  resolveSecretEnv,
  resolveServiceTcpEndpoint,
} from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';

@Injectable()
export class DialogConfigService {
  private readonly logger = new Logger(DialogConfigService.name);

  readonly nodeEnv: NodeEnvironment;
  readonly databaseUrl: string;
  readonly llmServiceHost: string;
  readonly llmServicePort: number;
  readonly internalServiceSecret: string;

  constructor() {
    this.nodeEnv = getNodeEnv();
    this.databaseUrl =
      this.nodeEnv === 'test' ? getOptionalEnv('DATABASE_URL', '') : getRequiredEnv('DATABASE_URL');

    const llmEndpoint = resolveServiceTcpEndpoint(ServiceName.LLM_SERVICE, {
      hostKey: 'LLM_SERVICE_HOST',
      portKey: 'LLM_SERVICE_PORT',
      urlKey: 'LLM_SERVICE_URL',
    });
    this.llmServiceHost = llmEndpoint.host;
    this.llmServicePort = llmEndpoint.port;
    this.internalServiceSecret = resolveSecretEnv('INTERNAL_SERVICE_SECRET', this.nodeEnv, (msg) =>
      this.logger.warn(msg),
    );
  }
}
