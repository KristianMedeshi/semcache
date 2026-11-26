import {
  baseEnvSchema,
  checkInternalSecret,
  defaultString,
  optionalString,
  positiveInt,
  z,
} from '@semcache/shared-config';

export const DEFAULT_EMBEDDING_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

export const embeddingEnvSchema = baseEnvSchema
  .extend({
    EMBEDDING_SERVICE_HOST: optionalString(),
    EMBEDDING_SERVICE_PORT: positiveInt('EMBEDDING_SERVICE_PORT').optional(),
    EMBEDDING_MODEL: defaultString(DEFAULT_EMBEDDING_MODEL),
    INTERNAL_SERVICE_SECRET: defaultString(''),
  })
  .superRefine(checkInternalSecret);

export type EmbeddingEnv = z.infer<typeof embeddingEnvSchema>;
