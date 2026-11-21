import {
  DEFAULT_SESSION_COOKIE_NAME,
  type DurationValue,
  baseEnvSchema,
  checkDatabaseUrl,
  checkInternalSecret,
  corsOriginsEnvSchema,
  defaultString,
  durationEnvSchema,
  optionalString,
  positiveInt,
  z,
} from '@semcache/shared-config';

export const DEFAULT_SESSION_TTL: DurationValue = '24h';
export const DEFAULT_SESSION_IDLE_TIMEOUT: DurationValue = '30m';
export const DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;

export const authEnvSchema = baseEnvSchema
  .extend({
    AUTH_SERVICE_HOST: optionalString(),
    AUTH_SERVICE_PORT: positiveInt('AUTH_SERVICE_PORT').optional(),
    DATABASE_URL: defaultString(''),
    INTERNAL_SERVICE_SECRET: defaultString(''),
    SESSION_COOKIE_NAME: defaultString(DEFAULT_SESSION_COOKIE_NAME),
    SESSION_TTL: durationEnvSchema('SESSION_TTL', DEFAULT_SESSION_TTL),
    SESSION_IDLE_TIMEOUT: durationEnvSchema('SESSION_IDLE_TIMEOUT', DEFAULT_SESSION_IDLE_TIMEOUT, {
      allowZero: true,
    }),
    LOGIN_RATE_LIMIT_WINDOW_MS: positiveInt('LOGIN_RATE_LIMIT_WINDOW_MS').default(
      DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS,
    ),
    LOGIN_RATE_LIMIT_MAX_ATTEMPTS: positiveInt('LOGIN_RATE_LIMIT_MAX_ATTEMPTS').default(
      DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    ),
    CORS_ORIGIN: corsOriginsEnvSchema(),
    SECURE_COOKIES: defaultString(''),
  })
  .superRefine((data, ctx) => {
    checkDatabaseUrl(data, ctx);
    checkInternalSecret(data, ctx);
  });

export type AuthEnv = z.infer<typeof authEnvSchema>;
