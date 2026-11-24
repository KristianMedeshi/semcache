import {
  baseEnvSchema,
  checkDatabaseUrl,
  checkInternalSecret,
  defaultString,
  optionalString,
  positiveInt,
  z,
} from '@semcache/shared-config';
import { SEMANTIC_CACHE_VALIDATION_LIMITS } from '@semcache/shared-dtos';
import { CacheMode } from '@semcache/shared-types';

const thresholdNumber = (fieldName: string, defaultValue: number) =>
  z.coerce
    .number()
    .min(SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_THRESHOLD, `${fieldName} must be between 0 and 1`)
    .max(SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_THRESHOLD, `${fieldName} must be between 0 and 1`)
    .default(defaultValue);

export const semanticCacheEnvSchema = baseEnvSchema
  .extend({
    SEMANTIC_CACHE_SERVICE_HOST: optionalString(),
    SEMANTIC_CACHE_SERVICE_PORT: positiveInt('SEMANTIC_CACHE_SERVICE_PORT').optional(),
    DATABASE_URL: defaultString(''),
    INTERNAL_SERVICE_SECRET: defaultString(''),
    SEMANTIC_CACHE_DEFAULT_MODE: z.nativeEnum(CacheMode).default(CacheMode.ADAPTIVE),
    SEMANTIC_CACHE_FIXED_THRESHOLD: thresholdNumber(
      'SEMANTIC_CACHE_FIXED_THRESHOLD',
      SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_FIXED_THRESHOLD,
    ),
    SEMANTIC_CACHE_ADAPTIVE_BASE_THRESHOLD: thresholdNumber(
      'SEMANTIC_CACHE_ADAPTIVE_BASE_THRESHOLD',
      SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_BASE_THRESHOLD,
    ),
    SEMANTIC_CACHE_MIN_ADAPTIVE_THRESHOLD: thresholdNumber(
      'SEMANTIC_CACHE_MIN_ADAPTIVE_THRESHOLD',
      SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_MIN_ADAPTIVE_THRESHOLD,
    ),
    SEMANTIC_CACHE_MAX_ADAPTIVE_THRESHOLD: thresholdNumber(
      'SEMANTIC_CACHE_MAX_ADAPTIVE_THRESHOLD',
      SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_MAX_ADAPTIVE_THRESHOLD,
    ),
    SEMANTIC_CACHE_DENSITY_WEIGHT: z.coerce
      .number()
      .min(
        SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_DENSITY_WEIGHT,
        `SEMANTIC_CACHE_DENSITY_WEIGHT must be >= ${SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_DENSITY_WEIGHT}`,
      )
      .max(
        SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_DENSITY_WEIGHT,
        `SEMANTIC_CACHE_DENSITY_WEIGHT must be <= ${SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_DENSITY_WEIGHT}`,
      )
      .default(SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_DENSITY_WEIGHT),
    SEMANTIC_CACHE_DENSITY_K_NEIGHBORS: z.coerce
      .number()
      .int('SEMANTIC_CACHE_DENSITY_K_NEIGHBORS must be an integer')
      .min(SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_DENSITY_K_NEIGHBORS)
      .max(SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_DENSITY_K_NEIGHBORS)
      .default(SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_DENSITY_K_NEIGHBORS),
  })
  .superRefine((data, ctx) => {
    checkDatabaseUrl(data, ctx);
    checkInternalSecret(data, ctx);
    if (data.SEMANTIC_CACHE_MIN_ADAPTIVE_THRESHOLD > data.SEMANTIC_CACHE_MAX_ADAPTIVE_THRESHOLD) {
      ctx.addIssue({
        code: 'custom',
        path: ['SEMANTIC_CACHE_MIN_ADAPTIVE_THRESHOLD'],
        message:
          'SEMANTIC_CACHE_MIN_ADAPTIVE_THRESHOLD must be <= SEMANTIC_CACHE_MAX_ADAPTIVE_THRESHOLD',
      });
    }
  });

export type SemanticCacheEnv = z.infer<typeof semanticCacheEnvSchema>;
