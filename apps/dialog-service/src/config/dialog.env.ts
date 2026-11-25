import {
  baseEnvSchema,
  checkDatabaseUrl,
  checkInternalSecret,
  defaultString,
  optionalString,
  positiveInt,
  serviceTcpEnvFields,
  z,
} from '@semcache/shared-config';

export const dialogEnvSchema = baseEnvSchema
  .extend({
    DIALOG_SERVICE_HOST: optionalString(),
    DIALOG_SERVICE_PORT: positiveInt('DIALOG_SERVICE_PORT').optional(),
    DATABASE_URL: defaultString(''),
    ...serviceTcpEnvFields('LLM_SERVICE'),
    ...serviceTcpEnvFields('KNOWLEDGE_BASE_SERVICE'),
    ...serviceTcpEnvFields('SEMANTIC_CACHE_SERVICE'),
    KB_RAG_TOP_K: positiveInt('KB_RAG_TOP_K').default(4),
    KB_RAG_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.25),
    INTERNAL_SERVICE_SECRET: defaultString(''),
  })
  .superRefine((data, ctx) => {
    checkDatabaseUrl(data, ctx);
    checkInternalSecret(data, ctx);
  });

export type DialogEnv = z.infer<typeof dialogEnvSchema>;
