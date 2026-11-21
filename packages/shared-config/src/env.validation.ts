import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import {
  DEFAULT_CORS_ORIGIN,
  DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS,
  DEFAULT_OPENROUTER_BASE_URL,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_OPENROUTER_TIMEOUT_MS,
  DEFAULT_SERVICE_HOST,
  DEFAULT_SESSION_COOKIE_NAME,
  DEFAULT_SESSION_IDLE_TIMEOUT,
  DEFAULT_SESSION_TTL,
  type DurationValue,
  MIN_INTERNAL_SECRET_LENGTH,
  NUMERIC_DURATION_REGEX,
  type NodeEnvironment,
  durationToMs,
  isFreeOpenRouterModel,
} from './constants';

/**
 * Walks up from `startDir` to the workspace root (`pnpm-workspace.yaml`) and returns
 * existing `.env` file paths ordered nearest-first.
 */
export function resolveEnvFilePaths(startDir: string = process.cwd()): string[] {
  const paths: string[] = [];
  let currentDir = resolve(startDir);

  while (true) {
    const envPath = join(currentDir, '.env');
    if (existsSync(envPath)) {
      paths.push(envPath);
    }

    if (existsSync(join(currentDir, 'pnpm-workspace.yaml'))) {
      break;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return paths;
}

const emptyToUndefined = (val: unknown): unknown =>
  typeof val === 'string' && val.trim() === '' ? undefined : val;

const optionalString = () => z.preprocess(emptyToUndefined, z.string().trim().optional());

const defaultString = (fallback: string) =>
  z.preprocess(emptyToUndefined, z.string().trim().default(fallback));

const positiveInt = (fieldName: string) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ message: `${fieldName} must be a positive integer` })
      .int(`${fieldName} must be a positive integer`)
      .positive(`${fieldName} must be a positive integer`),
  );

export const nodeEnvSchema = z.preprocess(
  emptyToUndefined,
  z.enum(['development', 'production', 'test']).default('development'),
);

export const durationEnvSchema = (
  fieldName: string,
  defaultValue: DurationValue,
  options?: { allowZero?: boolean },
) =>
  z
    .preprocess(emptyToUndefined, z.union([z.string().trim(), z.number()]).default(defaultValue))
    .transform((val): DurationValue => {
      if (typeof val === 'number') {
        return val;
      }
      return NUMERIC_DURATION_REGEX.test(val) ? Number(val) : (val as DurationValue);
    })
    .refine(
      (val) => {
        try {
          const ms = durationToMs(val);
          return options?.allowZero ? ms >= 0 : ms > 0;
        } catch {
          return false;
        }
      },
      { message: `${fieldName} must be a valid Duration` },
    );

export const corsOriginsEnvSchema = (defaultValue: string = DEFAULT_CORS_ORIGIN) =>
  defaultString(defaultValue)
    .transform((val) =>
      val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .refine((origins) => origins.length > 0, {
      message: 'CORS_ORIGIN must contain at least one origin',
    });

export const freeOpenRouterModelEnvSchema = defaultString(DEFAULT_OPENROUTER_MODEL).refine(
  isFreeOpenRouterModel,
  {
    message:
      'Invalid OPENROUTER_DEFAULT_MODEL. Only free OpenRouter models ("openrouter/free" or "<provider>/<model>:free") are allowed.',
  },
);

function checkInternalSecret(
  data: { NODE_ENV: NodeEnvironment; INTERNAL_SERVICE_SECRET: string },
  ctx: z.RefinementCtx,
): void {
  if (data.NODE_ENV === 'production' && data.INTERNAL_SERVICE_SECRET.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['INTERNAL_SERVICE_SECRET'],
      message: 'Missing required environment variable: INTERNAL_SERVICE_SECRET',
    });
  } else if (
    data.INTERNAL_SERVICE_SECRET.length > 0 &&
    data.INTERNAL_SERVICE_SECRET.length < MIN_INTERNAL_SECRET_LENGTH
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['INTERNAL_SERVICE_SECRET'],
      message: `INTERNAL_SERVICE_SECRET must be at least ${MIN_INTERNAL_SECRET_LENGTH} characters long`,
    });
  }
}

function checkDatabaseUrl(
  data: { NODE_ENV: NodeEnvironment; DATABASE_URL: string },
  ctx: z.RefinementCtx,
): void {
  if (data.NODE_ENV !== 'test' && data.DATABASE_URL.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['DATABASE_URL'],
      message: 'Missing required environment variable: DATABASE_URL',
    });
  }
}

export const baseEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  HOST: defaultString(DEFAULT_SERVICE_HOST),
  PORT: positiveInt('PORT').optional(),
});

export const databaseOnlyEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .trim()
    .min(1, { message: 'Missing required environment variable: DATABASE_URL' }),
});

export const gatewayEnvSchema = baseEnvSchema
  .extend({
    AUTH_SERVICE_HOST: optionalString(),
    AUTH_SERVICE_PORT: positiveInt('AUTH_SERVICE_PORT').optional(),
    AUTH_SERVICE_URL: optionalString(),
    DIALOG_SERVICE_HOST: optionalString(),
    DIALOG_SERVICE_PORT: positiveInt('DIALOG_SERVICE_PORT').optional(),
    DIALOG_SERVICE_URL: optionalString(),
    SESSION_COOKIE_NAME: defaultString(DEFAULT_SESSION_COOKIE_NAME),
    INTERNAL_SERVICE_SECRET: defaultString(''),
    CORS_ORIGIN: corsOriginsEnvSchema(),
  })
  .superRefine(checkInternalSecret);

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

export const llmEnvSchema = baseEnvSchema.extend({
  LLM_SERVICE_HOST: optionalString(),
  LLM_SERVICE_PORT: positiveInt('LLM_SERVICE_PORT').optional(),
  OPENROUTER_API_KEY: defaultString(''),
  OPENROUTER_BASE_URL: defaultString(DEFAULT_OPENROUTER_BASE_URL).transform((val) =>
    val.replace(/\/+$/, ''),
  ),
  OPENROUTER_DEFAULT_MODEL: freeOpenRouterModelEnvSchema,
  OPENROUTER_TIMEOUT_MS: positiveInt('OPENROUTER_TIMEOUT_MS').default(
    DEFAULT_OPENROUTER_TIMEOUT_MS,
  ),
});

export const semanticCacheEnvSchema = baseEnvSchema.extend({
  SEMANTIC_CACHE_SERVICE_HOST: optionalString(),
  SEMANTIC_CACHE_SERVICE_PORT: positiveInt('SEMANTIC_CACHE_SERVICE_PORT').optional(),
  DATABASE_URL: defaultString(''),
});

export const knowledgeBaseEnvSchema = baseEnvSchema.extend({
  KNOWLEDGE_BASE_SERVICE_HOST: optionalString(),
  KNOWLEDGE_BASE_SERVICE_PORT: positiveInt('KNOWLEDGE_BASE_SERVICE_PORT').optional(),
  DATABASE_URL: defaultString(''),
});
