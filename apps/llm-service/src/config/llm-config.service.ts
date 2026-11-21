import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type NodeEnvironment,
  createValidatedConfigService,
  llmEnvSchema,
} from '@semcache/shared-config';

@Injectable()
export class LlmConfigService {
  readonly nodeEnv: NodeEnvironment;
  readonly openRouterApiKey: string;
  readonly openRouterBaseUrl: string;
  readonly defaultModel: string;
  readonly requestTimeoutMs: number;

  constructor(
    @Optional()
    private readonly configService: ConfigService = createValidatedConfigService(llmEnvSchema),
  ) {
    this.nodeEnv = this.configService.getOrThrow<NodeEnvironment>('NODE_ENV');
    this.openRouterApiKey = this.configService.get<string>('OPENROUTER_API_KEY') ?? '';
    this.openRouterBaseUrl = this.configService.getOrThrow<string>('OPENROUTER_BASE_URL');
    this.defaultModel = this.configService.getOrThrow<string>('OPENROUTER_DEFAULT_MODEL');
    this.requestTimeoutMs = this.configService.getOrThrow<number>('OPENROUTER_TIMEOUT_MS');
  }
}
