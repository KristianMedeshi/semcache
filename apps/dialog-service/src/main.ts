import { NestFactory } from '@nestjs/core';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import { dialogEnvSchema, resolveMicroserviceTcpOptions } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { AppModule } from './app.module';

async function bootstrap() {
  const { host, port } = resolveMicroserviceTcpOptions(
    dialogEnvSchema,
    ServiceName.DIALOG_SERVICE,
    {
      hostKey: 'DIALOG_SERVICE_HOST',
      portKey: 'DIALOG_SERVICE_PORT',
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
