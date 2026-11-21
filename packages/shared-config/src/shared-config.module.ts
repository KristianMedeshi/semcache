import { randomBytes } from 'node:crypto';
import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServiceName } from '@semcache/shared-types';
import { z } from 'zod';
import {
  DEFAULT_SERVICE_HOST,
  DEFAULT_SERVICE_PORTS,
  MIN_INTERNAL_SECRET_LENGTH,
  type NodeEnvironment,
  type TcpEndpointConfig,
} from './constants';
import { baseEnvSchema, resolveEnvFilePaths } from './env.validation';

export interface SharedConfigModuleOptions<TSchema extends z.ZodType = z.ZodType> {
  schema?: TSchema;
  envFilePath?: string | string[];
  ignoreEnvFile?: boolean;
}

/**
 * Global NestJS configuration module wrapping `@nestjs/config`'s `ConfigModule`
 * with workspace `.env` discovery and Zod `validationSchema` validation.
 */
@Global()
@Module({})
export class SharedConfigModule {
  static forRoot<TSchema extends z.ZodType = typeof baseEnvSchema>(
    schemaOrOptions?: TSchema | SharedConfigModuleOptions<TSchema>,
  ): DynamicModule {
    const options =
      schemaOrOptions instanceof z.ZodType ? { schema: schemaOrOptions } : schemaOrOptions;
    const schema = options?.schema ?? baseEnvSchema;

    return {
      module: SharedConfigModule,
      global: true,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: false,
          envFilePath: options?.envFilePath ?? resolveEnvFilePaths(),
          ignoreEnvFile: options?.ignoreEnvFile ?? false,
          validationSchema: schema,
          load: [() => schema.parse(process.env) as Record<string, unknown>],
        }),
      ],
      exports: [ConfigModule],
    };
  }
}

function loadEnvFilesIntoProcess(envFilePaths: string[]): void {
  if (typeof process.loadEnvFile !== 'function') {
    return;
  }
  for (const envPath of envFilePaths) {
    process.loadEnvFile(envPath);
  }
}

/**
 * Creates a standalone `ConfigService` backed by a Zod-validated environment object.
 */
export function createValidatedConfigService<TSchema extends z.ZodType>(
  schema: TSchema,
  options?: { loadEnvFiles?: boolean },
): ConfigService {
  if (options?.loadEnvFiles !== false) {
    loadEnvFilesIntoProcess(resolveEnvFilePaths());
  }
  return new ConfigService(schema.parse(process.env) as Record<string, unknown>);
}

/**
 * Resolves a microservice's TCP host/port from `ConfigService`, with optional fallback
 * to a legacy URL config key, generic `HOST`/`PORT`, and default service ports.
 */
export function resolveServiceTcpEndpoint(
  configService: ConfigService,
  service: ServiceName,
  options?: {
    hostKey?: string;
    portKey?: string;
    urlKey?: string;
    fallbackToPortEnv?: boolean;
  },
): TcpEndpointConfig {
  const hostVal = options?.hostKey ? configService.get<string>(options.hostKey)?.trim() : undefined;
  const portVal = options?.portKey ? configService.get<number>(options.portKey) : undefined;
  const urlVal = options?.urlKey ? configService.get<string>(options.urlKey)?.trim() : undefined;

  let parsedHost: string | undefined;
  let parsedPort: number | undefined;
  if ((!hostVal || portVal === undefined) && urlVal) {
    try {
      const parsed = new URL(urlVal);
      parsedHost = parsed.hostname || undefined;
      if (parsed.port) {
        const numericPort = Number.parseInt(parsed.port, 10);
        if (!Number.isNaN(numericPort) && numericPort > 0) {
          parsedPort = numericPort;
        }
      }
    } catch {
      // Ignore malformed legacy URLs and fall back to defaults/explicit vars
    }
  }

  const genericHost = configService.get<string>('HOST')?.trim();
  const genericPort = options?.fallbackToPortEnv ? configService.get<number>('PORT') : undefined;

  return {
    host:
      (hostVal && hostVal.length > 0 ? hostVal : undefined) ??
      parsedHost ??
      (genericHost && genericHost.length > 0 ? genericHost : DEFAULT_SERVICE_HOST),
    port: portVal ?? parsedPort ?? genericPort ?? DEFAULT_SERVICE_PORTS[service],
  };
}

/**
 * Resolves a secret from `ConfigService`, enforcing minimum length and
 * generating an ephemeral random secret in non-production environments when unset.
 */
export function resolveSecretFromConfig(
  configService: ConfigService,
  key: string,
  nodeEnv: NodeEnvironment,
  onEphemeralWarning?: (message: string) => void,
): string {
  const value = configService.get<string>(key)?.trim() ?? '';

  if (nodeEnv === 'production' && value.length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  if (value.length > 0) {
    if (value.length < MIN_INTERNAL_SECRET_LENGTH) {
      throw new Error(`${key} must be at least ${MIN_INTERNAL_SECRET_LENGTH} characters long`);
    }
    return value;
  }

  if (nodeEnv === 'development') {
    onEphemeralWarning?.(
      `${key} is not configured; generating an ephemeral development-only secret`,
    );
  }
  return randomBytes(32).toString('hex');
}

/**
 * Validates the environment for a TCP microservice and resolves its bind `{ host, port }`.
 */
export function resolveMicroserviceTcpOptions<TSchema extends z.ZodType>(
  schema: TSchema,
  service: ServiceName,
  options: { hostKey: string; portKey: string },
): TcpEndpointConfig {
  const configService = createValidatedConfigService(schema);
  return resolveServiceTcpEndpoint(configService, service, {
    hostKey: options.hostKey,
    portKey: options.portKey,
    fallbackToPortEnv: true,
  });
}
