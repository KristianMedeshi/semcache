import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  ConfigService,
  buildCorsOptions,
  isTestSecurityBypassEnabled,
} from '@semcache/shared-config';
import type { GatewayEnv } from './config/gateway.env';
import { setupSwagger } from './swagger';

export function configureGatewayApp(app: INestApplication): void {
  const expressApp = app as Partial<NestExpressApplication>;
  if (typeof expressApp.set === 'function') {
    expressApp.set('trust proxy', 1);
  }

  const config = app.get<ConfigService<GatewayEnv, true>>(ConfigService);
  const corsOrigin = config.getOrThrow('CORS_ORIGIN');
  app.enableCors(buildCorsOptions(corsOrigin));

  const bypassSecurity = isTestSecurityBypassEnabled(
    config.getOrThrow('NODE_ENV'),
    config.get('TEST_BYPASS_SECURITY'),
  );
  if (!bypassSecurity) {
    app.enableCsrfProtection({ trustedOrigins: corsOrigin });
  }

  setupSwagger(app);
}
