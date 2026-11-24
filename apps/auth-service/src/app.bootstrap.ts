import type { INestApplication } from '@nestjs/common';
import {
  ConfigService,
  buildCorsOptions,
  isTestSecurityBypassEnabled,
} from '@semcache/shared-config';
import type { AuthEnv } from './config/auth.env';

export function configureAuthApp(app: INestApplication): void {
  const config = app.get<ConfigService<AuthEnv, true>>(ConfigService);
  const corsOrigin = config.getOrThrow('CORS_ORIGIN');
  app.enableCors(buildCorsOptions(corsOrigin));

  const bypassSecurity = isTestSecurityBypassEnabled(
    config.getOrThrow('NODE_ENV'),
    config.get('TEST_BYPASS_SECURITY'),
  );
  if (!bypassSecurity) {
    app.enableCsrfProtection({ trustedOrigins: corsOrigin });
  }
}
