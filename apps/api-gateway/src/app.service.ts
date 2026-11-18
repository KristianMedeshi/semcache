import { Injectable } from '@nestjs/common';
import type { HealthCheckResponseDto } from '@semcache/shared-dtos';
import { ServiceName } from '@semcache/shared-types';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getHealth(): HealthCheckResponseDto {
    return {
      service: ServiceName.API_GATEWAY,
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
