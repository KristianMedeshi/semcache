import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type NodeEnvironment,
  createValidatedConfigService,
  resolveSecretFromConfig,
  resolveServiceTcpEndpoint,
} from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { dialogEnvSchema } from './dialog.env';

@Injectable()
export class DialogConfigService {
  private readonly logger = new Logger(DialogConfigService.name);

  readonly nodeEnv: NodeEnvironment;
  readonly databaseUrl: string;
  readonly llmServiceHost: string;
  readonly llmServicePort: number;
  readonly internalServiceSecret: string;

  constructor(
    @Optional()
    private readonly configService: ConfigService = createValidatedConfigService(dialogEnvSchema),
  ) {
    this.nodeEnv = this.configService.getOrThrow<NodeEnvironment>('NODE_ENV');
    this.databaseUrl = this.configService.get<string>('DATABASE_URL') ?? '';

    const llmEndpoint = resolveServiceTcpEndpoint(this.configService, ServiceName.LLM_SERVICE, {
      hostKey: 'LLM_SERVICE_HOST',
      portKey: 'LLM_SERVICE_PORT',
      urlKey: 'LLM_SERVICE_URL',
    });
    this.llmServiceHost = llmEndpoint.host;
    this.llmServicePort = llmEndpoint.port;
    this.internalServiceSecret = resolveSecretFromConfig(
      this.configService,
      'INTERNAL_SERVICE_SECRET',
      this.nodeEnv,
      (msg: string) => this.logger.warn(msg),
    );
  }
}
