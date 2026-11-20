import { Injectable } from '@nestjs/common';
import {
  DEFAULT_OPENROUTER_BASE_URL,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_OPENROUTER_TIMEOUT_MS,
  type NodeEnvironment,
  getNodeEnv,
  getOptionalEnv,
  getPositiveIntEnv,
  isFreeOpenRouterModel,
} from '@semcache/shared-config';
import { FREE_OPENROUTER_MODEL_MESSAGE } from '@semcache/shared-dtos';

@Injectable()
export class LlmConfigService {
  readonly nodeEnv: NodeEnvironment;
  readonly openRouterApiKey: string;
  readonly openRouterBaseUrl: string;
  readonly defaultModel: string;
  readonly requestTimeoutMs: number;

  constructor() {
    this.nodeEnv = getNodeEnv();
    this.openRouterApiKey = getOptionalEnv('OPENROUTER_API_KEY', '');
    this.openRouterBaseUrl = getOptionalEnv(
      'OPENROUTER_BASE_URL',
      DEFAULT_OPENROUTER_BASE_URL,
    ).replace(/\/+$/, '');
    this.defaultModel = getOptionalEnv('OPENROUTER_DEFAULT_MODEL', DEFAULT_OPENROUTER_MODEL);
    this.requestTimeoutMs = getPositiveIntEnv(
      'OPENROUTER_TIMEOUT_MS',
      DEFAULT_OPENROUTER_TIMEOUT_MS,
    );

    if (!isFreeOpenRouterModel(this.defaultModel)) {
      throw new Error(
        `Invalid OPENROUTER_DEFAULT_MODEL "${this.defaultModel}". ${FREE_OPENROUTER_MODEL_MESSAGE}`,
      );
    }
  }
}
