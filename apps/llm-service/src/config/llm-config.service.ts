import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type NodeEnvironment,
  createValidatedConfigService,
  llmEnvSchema,
  resolveSecretFromConfig,
} from '@semcache/shared-config';

@Injectable()
export class LlmConfigService {
  private readonly logger = new Logger(LlmConfigService.name);

  readonly nodeEnv: NodeEnvironment;
  readonly openRouterApiKey: string;
  readonly openRouterBaseUrl: string;
  readonly defaultModel: string;
  readonly requestTimeoutMs: number;
  readonly internalServiceSecret: string;

  constructor(
    @Optional()
    private readonly configService: ConfigService = createValidatedConfigService(llmEnvSchema),
  ) {
    this.nodeEnv = this.configService.getOrThrow<NodeEnvironment>('NODE_ENV');
    this.openRouterApiKey = this.configService.get<string>('OPENROUTER_API_KEY') ?? '';
    this.openRouterBaseUrl = this.configService.getOrThrow<string>('OPENROUTER_BASE_URL');
    this.defaultModel = this.configService.getOrThrow<string>('OPENROUTER_DEFAULT_MODEL');
    this.requestTimeoutMs = this.configService.getOrThrow<number>('OPENROUTER_TIMEOUT_MS');
    this.internalServiceSecret = resolveSecretFromConfig(
      this.configService,
      'INTERNAL_SERVICE_SECRET',
      this.nodeEnv,
      (msg: string) => this.logger.warn(msg),
    );
  }
}
