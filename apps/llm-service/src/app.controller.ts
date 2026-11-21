import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import type { HealthCheckResponseDto } from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @MessagePattern(SERVICE_TCP_PATTERNS.APP_HELLO)
  getHello(): string {
    return this.appService.getHello();
  }

  @MessagePattern(SERVICE_TCP_PATTERNS.APP_HEALTH)
  getHealth(): HealthCheckResponseDto {
    return this.appService.getHealth();
  }
}
