import { Controller, Get } from '@nestjs/common';
import type { HealthCheckResponseDto } from '@semcache/shared-dtos';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): HealthCheckResponseDto {
    return this.appService.getHealth();
  }
}
