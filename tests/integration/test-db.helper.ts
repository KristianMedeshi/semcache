import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveEnvFilePaths } from '@semcache/shared-config';

function readDatabaseUrlFromEnvFile(filePath: string): string | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) {
      continue;
    }
    const key = line.slice(0, eqIdx).trim();
    if (key !== 'DATABASE_URL') {
      continue;
    }
    const rawVal = line.slice(eqIdx + 1).trim();
    const unquoted =
      (rawVal.startsWith('"') && rawVal.endsWith('"')) ||
      (rawVal.startsWith("'") && rawVal.endsWith("'"))
        ? rawVal.slice(1, -1)
        : rawVal;
    if (unquoted.trim().length > 0) {
      return unquoted.trim();
    }
  }
  return undefined;
}

export function loadIntegrationDatabaseUrl(serviceDir: string): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const envPaths = resolveEnvFilePaths(resolve(__dirname, '../..', serviceDir));
  for (const envPath of envPaths) {
    const found = readDatabaseUrlFromEnvFile(envPath);
    if (found) {
      return found;
    }
  }

  const sharedBackendEnv = resolve(__dirname, '../../packages/shared-config/.env.backend');
  const fallback = readDatabaseUrlFromEnvFile(sharedBackendEnv);
  if (fallback) {
    return fallback;
  }

  throw new Error('DATABASE_URL must be configured to run pgvector integration tests');
}

export function makeUnitVector384(
  primaryIndex: number,
  secondaryIndex?: number,
  secondaryWeight = 0,
): number[] {
  const vec = Array.from({ length: 384 }, () => 0);
  vec[primaryIndex] = 1;
  if (secondaryIndex !== undefined && secondaryWeight !== 0) {
    vec[secondaryIndex] = secondaryWeight;
  }
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map((v) => Number((v / norm).toFixed(8)));
}
