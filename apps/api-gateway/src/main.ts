import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DEFAULT_SERVICE_PORTS } from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { configureGatewayApp } from './app.bootstrap';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  configureGatewayApp(app);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? DEFAULT_SERVICE_PORTS[ServiceName.API_GATEWAY];
  await app.listen(port);
}
void bootstrap();
