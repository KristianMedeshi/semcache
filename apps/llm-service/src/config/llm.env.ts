import {
  baseEnvSchema,
  checkInternalSecret,
  defaultString,
  emptyToUndefined,
  optionalString,
  positiveInt,
  z,
} from '@semcache/shared-config';

export const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';
export const DEFAULT_OPENROUTER_TIMEOUT_MS = 180_000;
export const DEFAULT_LM_STUDIO_BASE_URL = 'http://localhost:1234/v1';
export const DEFAULT_LM_STUDIO_MODEL = 'support-llm';

const FREE_MODEL_PATTERN = /^(openrouter\/free|[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+:free)$/;

/**
 * Validates that an OpenRouter model identifier is explicitly zero-cost (`openrouter/free` or `*:free`).
 */
export function isFreeOpenRouterModel(modelId: string): boolean {
  return FREE_MODEL_PATTERN.test(modelId.trim());
}

/**
 * Returns true if the requested model should be routed to the local LM Studio provider.
 */
export function isLocalLlmModel(modelId: string, allowedLocalModels: readonly string[]): boolean {
  const trimmed = modelId.trim();
  return (
    allowedLocalModels.includes(trimmed) ||
    trimmed.startsWith('local/') ||
    trimmed.endsWith(':local')
  );
}

/**
 * Normalizes `local/<name>` or `<name>:local` identifiers into the raw LM Studio model ID.
 */
export function normalizeLocalModelId(modelId: string): string {
  const trimmed = modelId.trim();
  if (trimmed.startsWith('local/')) {
    return trimmed.slice('local/'.length);
  }
  if (trimmed.endsWith(':local')) {
    return trimmed.slice(0, -':local'.length);
  }
  return trimmed;
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
    LLM_PROVIDER: z.preprocess(
      emptyToUndefined,
      z.enum(['openrouter', 'lmstudio']).default('openrouter'),
    ),
    LM_STUDIO_BASE_URL: defaultString('').transform((val) => val.replace(/\/+$/, '')),
    LM_STUDIO_API_KEY: defaultString('lm-studio'),
    LM_STUDIO_DEFAULT_MODEL: defaultString(DEFAULT_LM_STUDIO_MODEL),
    LM_STUDIO_ALLOWED_MODELS: defaultString('support-llm,qwen/qwen3-1.7b').transform((val) =>
      val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    OPENROUTER_API_KEY: defaultString(''),
    OPENROUTER_BASE_URL: defaultString(DEFAULT_OPENROUTER_BASE_URL).transform((val) =>
      val.replace(/\/+$/, ''),
    ),
    OPENROUTER_DEFAULT_MODEL: freeOpenRouterModelEnvSchema,
    OPENROUTER_EMBEDDING_MODEL: defaultString('Xenova/paraphrase-multilingual-MiniLM-L12-v2'),
    OPENROUTER_TIMEOUT_MS: positiveInt('OPENROUTER_TIMEOUT_MS').default(
      DEFAULT_OPENROUTER_TIMEOUT_MS,
    ),
    INTERNAL_SERVICE_SECRET: defaultString(''),
  })
  .superRefine(checkInternalSecret);

export type LlmEnv = z.infer<typeof llmEnvSchema>;
