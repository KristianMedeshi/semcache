import { Controller, Get } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { HealthCheckResponseDto } from '@semcache/shared-dtos';
import { AppService } from './app.service';
import { HealthCheckSwaggerDto } from './common/dto/swagger-common.dto';

@ApiTags('Health')
@Public()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check API Gateway liveness status' })
  @ApiOkResponse({ description: 'Service is healthy', type: HealthCheckSwaggerDto })
  getHealth(): HealthCheckResponseDto {
    return this.appService.getHealth();
  }
}
