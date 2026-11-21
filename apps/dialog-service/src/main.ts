import { NestFactory } from '@nestjs/core';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import {
  DEFAULT_SERVICE_HOST,
  DEFAULT_SERVICE_PORTS,
  getNumericEnv,
  getOptionalEnv,
  loadEnv,
} from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { AppModule } from './app.module';

async function bootstrap() {
  loadEnv();
  const host = getOptionalEnv('DIALOG_SERVICE_HOST', getOptionalEnv('HOST', DEFAULT_SERVICE_HOST));
  const port = getNumericEnv(
    'DIALOG_SERVICE_PORT',
    getNumericEnv('PORT', DEFAULT_SERVICE_PORTS[ServiceName.DIALOG_SERVICE]),
  );
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.TCP,
    options: { host, port },
  });
  await app.listen();
}
void bootstrap();
