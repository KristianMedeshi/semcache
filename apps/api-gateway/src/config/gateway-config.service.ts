import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_SERVICE_PORTS,
  DEFAULT_SESSION_COOKIE_NAME,
  type NodeEnvironment,
  getCorsOriginsEnv,
  getNodeEnv,
  getOptionalEnv,
  resolveSecretEnv,
} from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';

@Injectable()
export class GatewayConfigService {
  private readonly logger = new Logger(GatewayConfigService.name);

  readonly nodeEnv: NodeEnvironment;
  readonly authServiceUrl: string;
  readonly dialogServiceUrl: string;
  readonly internalServiceSecret: string;
  readonly sessionCookieName: string;
  readonly corsOrigin: string[];

  constructor() {
    this.nodeEnv = getNodeEnv();

    const defaultAuthUrl = `http://localhost:${DEFAULT_SERVICE_PORTS[ServiceName.AUTH_SERVICE]}`;
    const defaultDialogUrl = `http://localhost:${DEFAULT_SERVICE_PORTS[ServiceName.DIALOG_SERVICE]}`;
    this.authServiceUrl = getOptionalEnv('AUTH_SERVICE_URL', defaultAuthUrl).replace(/\/+$/, '');
    this.dialogServiceUrl = getOptionalEnv('DIALOG_SERVICE_URL', defaultDialogUrl).replace(
      /\/+$/,
      '',
    );
    this.sessionCookieName = getOptionalEnv('SESSION_COOKIE_NAME', DEFAULT_SESSION_COOKIE_NAME);
    this.internalServiceSecret = resolveSecretEnv('INTERNAL_SERVICE_SECRET', this.nodeEnv, (msg) =>
      this.logger.warn(msg),
    );
    this.corsOrigin = getCorsOriginsEnv();
  }
}
