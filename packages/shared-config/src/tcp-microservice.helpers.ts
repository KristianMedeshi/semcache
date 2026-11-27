import {
  type ArgumentsHost,
  Catch,
  ConsoleLogger,
  HttpException,
  type NestApplicationOptions,
  type Provider,
  type Type,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE, NestFactory } from '@nestjs/core';
import {
  BaseRpcExceptionFilter,
  type ClientProxy,
  ClientProxyFactory,
  MessagePattern,
  type MicroserviceOptions,
  RpcException,
  Transport,
} from '@nestjs/microservices';
import { type HealthCheckStatus, SERVICE_TCP_PATTERNS, ServiceName } from '@semcache/shared-types';
import type { Observable } from 'rxjs';
import type { z } from 'zod';
import { DEFAULT_METRICS_PORTS } from './constants';
import {
  RpcMetricsInterceptor,
  SERVICE_NAME_TOKEN,
  startMetricsHttpServer,
} from './metrics.helpers';
import {
  createValidatedConfigService,
  resolveMicroserviceTcpOptions,
  resolveServiceTcpEndpoint,
} from './shared-config.module';

export const SERVICE_TCP_ENV_KEYS: Record<
  ServiceName,
  { hostKey: string; portKey: string; urlKey: string }
> = {
  [ServiceName.API_GATEWAY]: {
    hostKey: 'API_GATEWAY_HOST',
    portKey: 'API_GATEWAY_PORT',
    urlKey: 'API_GATEWAY_URL',
  },
  [ServiceName.AUTH_SERVICE]: {
    hostKey: 'AUTH_SERVICE_HOST',
    portKey: 'AUTH_SERVICE_PORT',
    urlKey: 'AUTH_SERVICE_URL',
  },
  [ServiceName.DIALOG_SERVICE]: {
    hostKey: 'DIALOG_SERVICE_HOST',
    portKey: 'DIALOG_SERVICE_PORT',
    urlKey: 'DIALOG_SERVICE_URL',
  },
  [ServiceName.SEMANTIC_CACHE_SERVICE]: {
    hostKey: 'SEMANTIC_CACHE_SERVICE_HOST',
    portKey: 'SEMANTIC_CACHE_SERVICE_PORT',
    urlKey: 'SEMANTIC_CACHE_SERVICE_URL',
  },
  [ServiceName.LLM_SERVICE]: {
    hostKey: 'LLM_SERVICE_HOST',
    portKey: 'LLM_SERVICE_PORT',
    urlKey: 'LLM_SERVICE_URL',
  },
  [ServiceName.KNOWLEDGE_BASE_SERVICE]: {
    hostKey: 'KNOWLEDGE_BASE_SERVICE_HOST',
    portKey: 'KNOWLEDGE_BASE_SERVICE_PORT',
    urlKey: 'KNOWLEDGE_BASE_SERVICE_URL',
  },
  [ServiceName.EMBEDDING_SERVICE]: {
    hostKey: 'EMBEDDING_SERVICE_HOST',
    portKey: 'EMBEDDING_SERVICE_PORT',
    urlKey: 'EMBEDDING_SERVICE_URL',
  },
};

/**
 * Translates NestJS `HttpException` instances into structured `RpcException` payloads
 * so status codes and error messages propagate cleanly across TCP transport.
 */
@Catch()
export class HttpToRpcExceptionFilter extends BaseRpcExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): Observable<unknown> {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const payload =
        typeof response === 'object' && response !== null
          ? (response as Record<string, unknown>)
          : { message: String(response) };

      return super.catch(
        new RpcException({
          ...payload,
          statusCode: exception.getStatus(),
        }),
        host,
      );
    }

    return super.catch(exception, host);
  }
}

/**
 * Creates the standard strict NestJS `ValidationPipe` shared across SemCache services.
 */
export function createStrictValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  });
}

/**
 * Returns the standard global filter, validation pipe, and optional RPC metrics interceptor
 * providers for TCP microservices.
 */
export function createRpcGlobalProviders(service?: ServiceName): Provider[] {
  const providers: Provider[] = [
    {
      provide: APP_FILTER,
      useClass: HttpToRpcExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useValue: createStrictValidationPipe(),
    },
  ];
  if (service) {
    providers.push(
      {
        provide: SERVICE_NAME_TOKEN,
        useValue: service,
      },
      {
        provide: APP_INTERCEPTOR,
        useClass: RpcMetricsInterceptor,
      },
    );
  }
  return providers;
}

/**
 * Creates a NestJS `ClientProxy` provider configured for synchronous `Transport.TCP`
 * communication with the given target microservice.
 */
export function createTcpClientProvider(provide: symbol | string, service: ServiceName): Provider {
  const keys = SERVICE_TCP_ENV_KEYS[service];
  return {
    provide,
    inject: [ConfigService],
    useFactory: (config: ConfigService<Record<string, unknown>, true>): ClientProxy => {
      const { host, port } = resolveServiceTcpEndpoint(config, service, keys);
      return ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host, port },
      });
    },
  };
}

/**
 * Returns NestJS logger options emitting redacted JSON logs to stdout in production.
 */
export function createProductionLoggerOptions(): Pick<NestApplicationOptions, 'logger'> {
  if (process.env.NODE_ENV !== 'production') {
    return {};
  }

  return {
    logger: new ConsoleLogger({
      json: true,
      logLevels: ['log', 'warn', 'error', 'fatal'],
      redact: ['password', 'authorization', 'cookie'],
    }),
  };
}

/**
 * Bootstraps a standalone NestJS TCP microservice with validated environment options
 * and graceful shutdown hooks.
 */
export async function bootstrapTcpMicroservice<TSchema extends z.ZodType<Record<string, unknown>>>(
  appModule: Type<unknown>,
  envSchema: TSchema,
  service: ServiceName,
): Promise<void> {
  const keys = SERVICE_TCP_ENV_KEYS[service];
  const { host, port } = resolveMicroserviceTcpOptions(envSchema, service, {
    hostKey: keys.hostKey,
    portKey: keys.portKey,
  });
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(appModule, {
    transport: Transport.TCP,
    options: { host, port },
    ...createProductionLoggerOptions(),
  });
  app.enableShutdownHooks();
  await app.listen();

  const envConfig = createValidatedConfigService(envSchema, { loadEnvFiles: false });
  const metricsEnabled = envConfig.get<boolean | undefined>('METRICS_ENABLED') !== false;
  if (
    metricsEnabled &&
    process.env.JEST_WORKER_ID === undefined &&
    service !== ServiceName.API_GATEWAY
  ) {
    const metricsHost =
      envConfig.get<string | undefined>('METRICS_HOST')?.trim() || host || '0.0.0.0';
    const metricsPort =
      envConfig.get<number | undefined>('METRICS_PORT') ?? DEFAULT_METRICS_PORTS[service];
    const metricsServer = await startMetricsHttpServer({
      service,
      host: metricsHost,
      port: metricsPort,
    });
    const closeMetrics = () => {
      metricsServer.close();
    };
    process.once('SIGINT', closeMetrics);
    process.once('SIGTERM', closeMetrics);
  }
}

/**
 * Builds the canonical health check response payload for a microservice.
 */
export function createHealthCheckResponse(service: ServiceName): {
  service: ServiceName;
  status: 'ok';
  timestamp: string;
} {
  return {
    service,
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Shared base controller for TCP microservices exposing the `app.health` message pattern.
 */
export abstract class BaseTcpHealthController {
  protected constructor(private readonly healthService: { getHealth(): HealthCheckStatus }) {}

  @MessagePattern(SERVICE_TCP_PATTERNS.APP_HEALTH)
  getHealth(): HealthCheckStatus {
    return this.healthService.getHealth();
  }
}
