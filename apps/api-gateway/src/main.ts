import { NestFactory } from '@nestjs/core';
import { DEFAULT_SERVICE_PORTS, getNumericEnv } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = getNumericEnv('PORT', DEFAULT_SERVICE_PORTS[ServiceName.API_GATEWAY]);
  await app.listen(port);
}
void bootstrap();
