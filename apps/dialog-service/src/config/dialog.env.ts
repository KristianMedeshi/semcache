import {
  baseEnvSchema,
  checkDatabaseUrl,
  checkInternalSecret,
  defaultString,
  optionalString,
  positiveInt,
  z,
} from '@semcache/shared-config';

export const dialogEnvSchema = baseEnvSchema
  .extend({
    DIALOG_SERVICE_HOST: optionalString(),
    DIALOG_SERVICE_PORT: positiveInt('DIALOG_SERVICE_PORT').optional(),
    DATABASE_URL: defaultString(''),
    LLM_SERVICE_HOST: optionalString(),
    LLM_SERVICE_PORT: positiveInt('LLM_SERVICE_PORT').optional(),
    LLM_SERVICE_URL: optionalString(),
    INTERNAL_SERVICE_SECRET: defaultString(''),
  })
  .superRefine((data, ctx) => {
    checkDatabaseUrl(data, ctx);
    checkInternalSecret(data, ctx);
  });

export type DialogEnv = z.infer<typeof dialogEnvSchema>;
