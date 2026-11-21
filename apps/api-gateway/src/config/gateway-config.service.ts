import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type NodeEnvironment,
  createValidatedConfigService,
  resolveSecretFromConfig,
  resolveServiceTcpEndpoint,
} from '@semcache/shared-config';
import { ServiceName } from '@semcache/shared-types';
import { gatewayEnvSchema } from './gateway.env';

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

  constructor(
    @Optional()
    private readonly configService: ConfigService = createValidatedConfigService(gatewayEnvSchema),
  ) {
    this.nodeEnv = this.configService.getOrThrow<NodeEnvironment>('NODE_ENV');

    const authEndpoint = resolveServiceTcpEndpoint(this.configService, ServiceName.AUTH_SERVICE, {
      hostKey: 'AUTH_SERVICE_HOST',
      portKey: 'AUTH_SERVICE_PORT',
      urlKey: 'AUTH_SERVICE_URL',
    });
    const dialogEndpoint = resolveServiceTcpEndpoint(
      this.configService,
      ServiceName.DIALOG_SERVICE,
      {
        hostKey: 'DIALOG_SERVICE_HOST',
        portKey: 'DIALOG_SERVICE_PORT',
        urlKey: 'DIALOG_SERVICE_URL',
      },
    );

    this.authServiceHost = authEndpoint.host;
    this.authServicePort = authEndpoint.port;
    this.dialogServiceHost = dialogEndpoint.host;
    this.dialogServicePort = dialogEndpoint.port;
    this.sessionCookieName = this.configService.getOrThrow<string>('SESSION_COOKIE_NAME');
    this.internalServiceSecret = resolveSecretFromConfig(
      this.configService,
      'INTERNAL_SERVICE_SECRET',
      this.nodeEnv,
      (msg: string) => this.logger.warn(msg),
    );
    this.corsOrigin = this.configService.getOrThrow<string[]>('CORS_ORIGIN');
  }
}
