import type { INestApplication } from '@nestjs/common';
import { buildCorsOptions } from '@semcache/shared-config';
import { GatewayConfigService } from './config/gateway-config.service';

export function configureGatewayApp(app: INestApplication): void {
  const { corsOrigin } = app.get(GatewayConfigService);
  app.enableCors(buildCorsOptions(corsOrigin));
  app.enableCsrfProtection({ trustedOrigins: corsOrigin });
}
