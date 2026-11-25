import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { HealthCheckResponseDto } from '@semcache/shared-dtos';
import { ServiceName } from '@semcache/shared-types';

export class HealthCheckSwaggerDto implements HealthCheckResponseDto {
  @ApiProperty({ example: ServiceName.API_GATEWAY })
  service!: string;

  @ApiProperty({ enum: ['ok', 'degraded', 'down'], example: 'ok' })
  status!: 'ok' | 'degraded' | 'down';

  @ApiProperty({ format: 'date-time', example: '2026-01-01T00:00:00.000Z' })
  timestamp!: string;
}

export class ApiErrorSwaggerDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Validation failed',
  })
  message!: string | string[];

  @ApiPropertyOptional({ example: 'Bad Request' })
  error?: string;

  @ApiPropertyOptional({ example: 'AUTH_INVALID_CREDENTIALS' })
  errorCode?: string;
}
