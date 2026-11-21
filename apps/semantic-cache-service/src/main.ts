import { NestFactory } from '@nestjs/core';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import { resolveMicroserviceTcpOptions } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { AppModule } from './app.module';
import { semanticCacheEnvSchema } from './config/semantic-cache.env';

async function bootstrap() {
  const { host, port } = resolveMicroserviceTcpOptions(
    semanticCacheEnvSchema,
    ServiceName.SEMANTIC_CACHE_SERVICE,
    {
      hostKey: 'SEMANTIC_CACHE_SERVICE_HOST',
      portKey: 'SEMANTIC_CACHE_SERVICE_PORT',
    },
  );
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.TCP,
    options: { host, port },
  });
  app.enableShutdownHooks();
  await app.listen();
}
void bootstrap();
