import type { INestApplication } from '@nestjs/common';
import { buildCorsOptions } from '@semcache/shared-config';
import { AuthConfigService } from './config/auth-config.service';

export function configureAuthApp(app: INestApplication): void {
  const { corsOrigin } = app.get(AuthConfigService);
  app.enableCors(buildCorsOptions(corsOrigin));
  app.enableCsrfProtection({ trustedOrigins: corsOrigin });
}
