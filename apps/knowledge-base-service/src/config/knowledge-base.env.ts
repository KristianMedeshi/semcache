import {
  baseEnvSchema,
  checkDatabaseUrl,
  checkInternalSecret,
  defaultString,
  optionalString,
  positiveInt,
  z,
} from '@semcache/shared-config';
import { KNOWLEDGE_BASE_VALIDATION_LIMITS } from '@semcache/shared-dtos';

export const knowledgeBaseEnvSchema = baseEnvSchema
  .extend({
    KNOWLEDGE_BASE_SERVICE_HOST: optionalString(),
    KNOWLEDGE_BASE_SERVICE_PORT: positiveInt('KNOWLEDGE_BASE_SERVICE_PORT').optional(),
    DATABASE_URL: defaultString(''),
    LLM_SERVICE_HOST: optionalString(),
    LLM_SERVICE_PORT: positiveInt('LLM_SERVICE_PORT').optional(),
    LLM_SERVICE_URL: optionalString(),
    KB_CHUNK_SIZE: positiveInt('KB_CHUNK_SIZE').default(
      KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_CHUNK_SIZE,
    ),
    KB_CHUNK_OVERLAP: z.coerce
      .number()
      .int('KB_CHUNK_OVERLAP must be an integer')
      .min(0, 'KB_CHUNK_OVERLAP must be non-negative')
      .default(KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_CHUNK_OVERLAP),
    KB_DEFAULT_TOP_K: positiveInt('KB_DEFAULT_TOP_K').default(
      KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_TOP_K,
    ),
    KB_MIN_SIMILARITY: z.coerce
      .number()
      .min(0, 'KB_MIN_SIMILARITY must be between 0 and 1')
      .max(1, 'KB_MIN_SIMILARITY must be between 0 and 1')
      .default(KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_MIN_SIMILARITY),
    INTERNAL_SERVICE_SECRET: defaultString(''),
  })
  .superRefine((data, ctx) => {
    checkDatabaseUrl(data, ctx);
    checkInternalSecret(data, ctx);
    if (data.KB_CHUNK_OVERLAP >= data.KB_CHUNK_SIZE) {
      ctx.addIssue({
        code: 'custom',
        path: ['KB_CHUNK_OVERLAP'],
        message: 'KB_CHUNK_OVERLAP must be strictly smaller than KB_CHUNK_SIZE',
      });
    }
  });

export type KnowledgeBaseEnv = z.infer<typeof knowledgeBaseEnvSchema>;
