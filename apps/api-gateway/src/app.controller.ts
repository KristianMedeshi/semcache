import { Controller, Get } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import type { HealthCheckResponseDto } from '@semcache/shared-dtos';
import { AppService } from './app.service';

@Public()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): HealthCheckResponseDto {
    return this.appService.getHealth();
  }
}
