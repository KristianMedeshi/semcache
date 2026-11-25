import { Injectable } from '@nestjs/common';
import { createHealthCheckResponse } from '@semcache/shared-config';
import type { HealthCheckResponseDto } from '@semcache/shared-dtos';
import { ServiceName } from '@semcache/shared-types';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getHealth(): HealthCheckResponseDto {
    return createHealthCheckResponse(ServiceName.DIALOG_SERVICE);
  }
}
