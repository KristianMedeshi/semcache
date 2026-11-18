import type { INestApplication } from '@nestjs/common';
import { GatewayConfigService } from './config/gateway-config.service';

export function configureGatewayApp(app: INestApplication): void {
  const config = app.get(GatewayConfigService);

  app.enableCors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.enableCsrfProtection({
    trustedOrigins: config.corsOrigin,
  });
}
