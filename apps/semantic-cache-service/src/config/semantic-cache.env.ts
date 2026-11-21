import {
  baseEnvSchema,
  checkInternalSecret,
  defaultString,
  optionalString,
  positiveInt,
} from '@semcache/shared-config';

export const semanticCacheEnvSchema = baseEnvSchema
  .extend({
    SEMANTIC_CACHE_SERVICE_HOST: optionalString(),
    SEMANTIC_CACHE_SERVICE_PORT: positiveInt('SEMANTIC_CACHE_SERVICE_PORT').optional(),
    DATABASE_URL: defaultString(''),
    INTERNAL_SERVICE_SECRET: defaultString(''),
  })
  .superRefine(checkInternalSecret);
