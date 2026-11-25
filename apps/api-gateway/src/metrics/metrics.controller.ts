import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';

@ApiTags('Metrics')
@Public()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: 'Expose Prometheus metrics in text exposition format' })
  @ApiProduces('text/plain')
  @ApiOkResponse({
    description: 'Prometheus exposition format metrics',
    schema: { type: 'string' },
  })
  getMetrics(): string {
    return this.metricsService.renderPrometheusMetrics();
  }
}
