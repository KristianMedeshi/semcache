import type { INestApplication } from '@nestjs/common';
import { AuthConfigService } from './config/auth-config.service';

export function configureAuthApp(app: INestApplication): void {
  const config = app.get(AuthConfigService);

  app.enableCors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.enableCsrfProtection({
    trustedOrigins: config.corsOrigin,
  });
}
