import {
  baseEnvSchema,
  checkInternalSecret,
  defaultString,
  optionalString,
  positiveInt,
  z,
} from '@semcache/shared-config';

export const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';
export const DEFAULT_OPENROUTER_TIMEOUT_MS = 180_000;

const FREE_MODEL_PATTERN = /^(openrouter\/free|[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+:free)$/;

/**
 * Validates that an OpenRouter model identifier is explicitly zero-cost (`openrouter/free` or `*:free`).
 */
export function isFreeOpenRouterModel(modelId: string): boolean {
  return FREE_MODEL_PATTERN.test(modelId.trim());
}

export const freeOpenRouterModelEnvSchema = defaultString(DEFAULT_OPENROUTER_MODEL).refine(
  isFreeOpenRouterModel,
  {
    message:
      'Invalid OPENROUTER_DEFAULT_MODEL. Only free OpenRouter models ("openrouter/free" or "<provider>/<model>:free") are allowed.',
  },
);

export const llmEnvSchema = baseEnvSchema
  .extend({
    LLM_SERVICE_HOST: optionalString(),
    LLM_SERVICE_PORT: positiveInt('LLM_SERVICE_PORT').optional(),
    OPENROUTER_API_KEY: defaultString(''),
    OPENROUTER_BASE_URL: defaultString(DEFAULT_OPENROUTER_BASE_URL).transform((val) =>
      val.replace(/\/+$/, ''),
    ),
    OPENROUTER_DEFAULT_MODEL: freeOpenRouterModelEnvSchema,
    OPENROUTER_TIMEOUT_MS: positiveInt('OPENROUTER_TIMEOUT_MS').default(
      DEFAULT_OPENROUTER_TIMEOUT_MS,
    ),
    INTERNAL_SERVICE_SECRET: defaultString(''),
  })
  .superRefine(checkInternalSecret);

export type LlmEnv = z.infer<typeof llmEnvSchema>;
