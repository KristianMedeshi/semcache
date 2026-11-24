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

function findWorkspaceRoot(startDir: string): string | null {
  let currentDir = resolve(startDir);
  while (true) {
    if (existsSync(join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
}

/**
 * Returns existing env file paths ordered highest-priority-first:
 * 1. The app's local `.env` in `startDir`
 * 2. The optional `packages/shared-config/.env.backend` for variables shared across backend microservices
 *
 * Root `.env` is intentionally ignored so Docker/root config never leaks into apps.
 */
export function resolveEnvFilePaths(startDir: string = process.cwd()): string[] {
  const paths: string[] = [];
  const localEnvPath = join(resolve(startDir), '.env');
  if (existsSync(localEnvPath)) {
    paths.push(localEnvPath);
  }

  const workspaceRoot = findWorkspaceRoot(startDir);
  if (workspaceRoot) {
    const sharedEnvPath = join(workspaceRoot, 'packages', 'shared-config', '.env.backend');
    if (existsSync(sharedEnvPath)) {
      paths.push(sharedEnvPath);
    }
  }

  return paths;
}

export const emptyToUndefined = (val: unknown): unknown =>
  typeof val === 'string' && val.trim() === '' ? undefined : val;

export const optionalString = () => z.preprocess(emptyToUndefined, z.string().trim().optional());

export const optionalBooleanEnvSchema = () =>
  z.preprocess((val) => {
    if (typeof val === 'boolean') {
      return val;
    }
    if (typeof val === 'string') {
      const normalized = val.trim().toLowerCase();
      if (normalized === '') {
        return undefined;
      }
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }
    return val;
  }, z.boolean().optional());

/**
 * Returns true only when `NODE_ENV === 'test'` and security bypass is enabled.
 * Outside Jest (`JEST_WORKER_ID` unset), `NODE_ENV=test` enables the bypass automatically
 * unless `TEST_BYPASS_SECURITY=false`; inside Jest it requires `TEST_BYPASS_SECURITY=true`.
 */
export function isTestSecurityBypassEnabled(
  nodeEnv: NodeEnvironment,
  explicitFlag?: boolean,
): boolean {
  if (nodeEnv !== 'test') {
    return false;
  }
  if (explicitFlag !== undefined) {
    return explicitFlag;
  }
  return process.env.JEST_WORKER_ID === undefined;
}

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
  TEST_BYPASS_SECURITY: optionalBooleanEnvSchema(),
});

export const databaseOnlyEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .trim()
    .min(1, { message: 'Missing required environment variable: DATABASE_URL' }),
});
