import { NestFactory } from '@nestjs/core';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import { knowledgeBaseEnvSchema, resolveMicroserviceTcpOptions } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { AppModule } from './app.module';

async function bootstrap() {
  const { host, port } = resolveMicroserviceTcpOptions(
    knowledgeBaseEnvSchema,
    ServiceName.KNOWLEDGE_BASE_SERVICE,
    {
      hostKey: 'KNOWLEDGE_BASE_SERVICE_HOST',
      portKey: 'KNOWLEDGE_BASE_SERVICE_PORT',
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
