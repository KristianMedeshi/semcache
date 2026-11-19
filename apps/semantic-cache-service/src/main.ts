import { NestFactory } from '@nestjs/core';
import { DEFAULT_SERVICE_PORTS, getNumericEnv, loadEnv } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { AppModule } from './app.module';

async function bootstrap() {
  loadEnv();
  const app = await NestFactory.create(AppModule);
  const port = getNumericEnv('PORT', DEFAULT_SERVICE_PORTS[ServiceName.SEMANTIC_CACHE_SERVICE]);
  await app.listen(port);
}
void bootstrap();
