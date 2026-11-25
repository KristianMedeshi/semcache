import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  DEFAULT_SERVICE_HOST,
  DEFAULT_SERVICE_PORTS,
  createProductionLoggerOptions,
} from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { configureGatewayApp } from './app.bootstrap';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    createProductionLoggerOptions(),
  );
  app.enableShutdownHooks();
  configureGatewayApp(app);

  const server = app.getHttpServer();
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  const configService = app.get(ConfigService);
  const host = configService.get<string>('HOST') ?? DEFAULT_SERVICE_HOST;
  const port = configService.get<number>('PORT') ?? DEFAULT_SERVICE_PORTS[ServiceName.API_GATEWAY];
  await app.listen(port, host);
}
void bootstrap();
