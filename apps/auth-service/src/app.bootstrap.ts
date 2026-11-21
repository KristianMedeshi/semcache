import type { INestApplication } from '@nestjs/common';
import { ConfigService, buildCorsOptions } from '@semcache/shared-config';
import type { AuthEnv } from './config/auth.env';

export function configureAuthApp(app: INestApplication): void {
  const config = app.get<ConfigService<AuthEnv, true>>(ConfigService);
  const corsOrigin = config.getOrThrow('CORS_ORIGIN');
  app.enableCors(buildCorsOptions(corsOrigin));
  app.enableCsrfProtection({ trustedOrigins: corsOrigin });
}
