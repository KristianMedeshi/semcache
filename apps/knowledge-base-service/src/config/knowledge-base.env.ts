import {
  baseEnvSchema,
  checkInternalSecret,
  defaultString,
  optionalString,
  positiveInt,
} from '@semcache/shared-config';

export const knowledgeBaseEnvSchema = baseEnvSchema
  .extend({
    KNOWLEDGE_BASE_SERVICE_HOST: optionalString(),
    KNOWLEDGE_BASE_SERVICE_PORT: positiveInt('KNOWLEDGE_BASE_SERVICE_PORT').optional(),
    DATABASE_URL: defaultString(''),
    INTERNAL_SERVICE_SECRET: defaultString(''),
  })
  .superRefine(checkInternalSecret);
