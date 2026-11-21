import { NestFactory } from '@nestjs/core';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import { llmEnvSchema, resolveMicroserviceTcpOptions } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { AppModule } from './app.module';

async function bootstrap() {
  const { host, port } = resolveMicroserviceTcpOptions(llmEnvSchema, ServiceName.LLM_SERVICE, {
    hostKey: 'LLM_SERVICE_HOST',
    portKey: 'LLM_SERVICE_PORT',
  });
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.TCP,
    options: { host, port },
  });
  app.enableShutdownHooks();
  await app.listen();
}
void bootstrap();
