import {
  DEFAULT_SESSION_COOKIE_NAME,
  baseEnvSchema,
  checkInternalSecret,
  corsOriginsEnvSchema,
  defaultString,
  optionalString,
  positiveInt,
  z,
} from '@semcache/shared-config';

export const gatewayEnvSchema = baseEnvSchema
  .extend({
    AUTH_SERVICE_HOST: optionalString(),
    AUTH_SERVICE_PORT: positiveInt('AUTH_SERVICE_PORT').optional(),
    AUTH_SERVICE_URL: optionalString(),
    DIALOG_SERVICE_HOST: optionalString(),
    DIALOG_SERVICE_PORT: positiveInt('DIALOG_SERVICE_PORT').optional(),
    DIALOG_SERVICE_URL: optionalString(),
    KNOWLEDGE_BASE_SERVICE_HOST: optionalString(),
    KNOWLEDGE_BASE_SERVICE_PORT: positiveInt('KNOWLEDGE_BASE_SERVICE_PORT').optional(),
    KNOWLEDGE_BASE_SERVICE_URL: optionalString(),
    SEMANTIC_CACHE_SERVICE_HOST: optionalString(),
    SEMANTIC_CACHE_SERVICE_PORT: positiveInt('SEMANTIC_CACHE_SERVICE_PORT').optional(),
    SEMANTIC_CACHE_SERVICE_URL: optionalString(),
    SESSION_COOKIE_NAME: defaultString(DEFAULT_SESSION_COOKIE_NAME),
    INTERNAL_SERVICE_SECRET: defaultString(''),
    CORS_ORIGIN: corsOriginsEnvSchema(),
  })
  .superRefine(checkInternalSecret);

export type GatewayEnv = z.infer<typeof gatewayEnvSchema>;
