import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import {
  DEFAULT_CORS_ORIGIN,
  DEFAULT_SERVICE_HOST,
  type DurationValue,
  MIN_INTERNAL_SECRET_LENGTH,
  NUMERIC_DURATION_REGEX,
  type NodeEnvironment,
  durationToMs,
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

export const emptyToUndefined = (val: unknown): unknown =>
  typeof val === 'string' && val.trim() === '' ? undefined : val;

export const optionalString = () => z.preprocess(emptyToUndefined, z.string().trim().optional());

export const defaultString = (fallback: string) =>
  z.preprocess(emptyToUndefined, z.string().trim().default(fallback));

export const positiveInt = (fieldName: string) =>
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

export function checkInternalSecret(
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

export function checkDatabaseUrl(
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
