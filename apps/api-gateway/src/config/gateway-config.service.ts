import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_SESSION_COOKIE_NAME,
  type NodeEnvironment,
  getCorsOriginsEnv,
  getNodeEnv,
  getOptionalEnv,
  resolveSecretEnv,
  resolveServiceTcpEndpoint,
} from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';

@Injectable()
export class GatewayConfigService {
  private readonly logger = new Logger(GatewayConfigService.name);

  readonly nodeEnv: NodeEnvironment;
  readonly authServiceHost: string;
  readonly authServicePort: number;
  readonly dialogServiceHost: string;
  readonly dialogServicePort: number;
  readonly internalServiceSecret: string;
  readonly sessionCookieName: string;
  readonly corsOrigin: string[];

  constructor() {
    this.nodeEnv = getNodeEnv();

    const authEndpoint = resolveServiceTcpEndpoint(ServiceName.AUTH_SERVICE, {
      hostKey: 'AUTH_SERVICE_HOST',
      portKey: 'AUTH_SERVICE_PORT',
      urlKey: 'AUTH_SERVICE_URL',
    });
    const dialogEndpoint = resolveServiceTcpEndpoint(ServiceName.DIALOG_SERVICE, {
      hostKey: 'DIALOG_SERVICE_HOST',
      portKey: 'DIALOG_SERVICE_PORT',
      urlKey: 'DIALOG_SERVICE_URL',
    });

    this.authServiceHost = authEndpoint.host;
    this.authServicePort = authEndpoint.port;
    this.dialogServiceHost = dialogEndpoint.host;
    this.dialogServicePort = dialogEndpoint.port;
    this.sessionCookieName = getOptionalEnv('SESSION_COOKIE_NAME', DEFAULT_SESSION_COOKIE_NAME);
    this.internalServiceSecret = resolveSecretEnv('INTERNAL_SERVICE_SECRET', this.nodeEnv, (msg) =>
      this.logger.warn(msg),
    );
    this.corsOrigin = getCorsOriginsEnv();
  }
}
