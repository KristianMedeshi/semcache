import {
  DEFAULT_SESSION_COOKIE_NAME,
  baseEnvSchema,
  checkInternalSecret,
  corsOriginsEnvSchema,
  defaultString,
  serviceTcpEnvFields,
  z,
} from '@semcache/shared-config';

export const gatewayEnvSchema = baseEnvSchema
  .extend({
    ...serviceTcpEnvFields('AUTH_SERVICE'),
    ...serviceTcpEnvFields('DIALOG_SERVICE'),
    ...serviceTcpEnvFields('KNOWLEDGE_BASE_SERVICE'),
    ...serviceTcpEnvFields('SEMANTIC_CACHE_SERVICE'),
    SESSION_COOKIE_NAME: defaultString(DEFAULT_SESSION_COOKIE_NAME),
    INTERNAL_SERVICE_SECRET: defaultString(''),
    CORS_ORIGIN: corsOriginsEnvSchema(),
  })
  .superRefine(checkInternalSecret);

export type GatewayEnv = z.infer<typeof gatewayEnvSchema>;
