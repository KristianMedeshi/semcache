import type { INestApplication } from '@nestjs/common';
import { ConfigService, buildCorsOptions } from '@semcache/shared-config';
import type { GatewayEnv } from './config/gateway.env';

export function configureGatewayApp(app: INestApplication): void {
  const config = app.get<ConfigService<GatewayEnv, true>>(ConfigService);
  const corsOrigin = config.getOrThrow('CORS_ORIGIN');
  app.enableCors(buildCorsOptions(corsOrigin));
  app.enableCsrfProtection({ trustedOrigins: corsOrigin });
}
