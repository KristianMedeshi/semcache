import { applyDecorators } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiProduces,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorSwaggerDto } from '../dto/swagger-common.dto';

export interface StandardErrorOptions {
  badRequest?: boolean;
  auth?: boolean;
  forbidden?: boolean;
  notFound?: boolean;
  conflict?: boolean;
  tooManyRequests?: boolean;
  badGateway?: boolean;
}

export function ApiStandardErrors(options: StandardErrorOptions = {}): MethodDecorator {
  const decorators: MethodDecorator[] = [];

  if (options.badRequest) {
    decorators.push(
      ApiBadRequestResponse({
        description: 'Validation failed or malformed request parameters',
        type: ApiErrorSwaggerDto,
      }),
    );
  }
  if (options.auth) {
    decorators.push(
      ApiUnauthorizedResponse({
        description: 'Missing, invalid, or expired session cookie',
        type: ApiErrorSwaggerDto,
      }),
    );
  }
  if (options.forbidden) {
    decorators.push(
      ApiForbiddenResponse({
        description: 'Insufficient permissions or blocked cross-origin request',
        type: ApiErrorSwaggerDto,
      }),
    );
  }
  if (options.notFound) {
    decorators.push(
      ApiNotFoundResponse({
        description: 'Requested resource was not found',
        type: ApiErrorSwaggerDto,
      }),
    );
  }
  if (options.conflict) {
    decorators.push(
      ApiConflictResponse({
        description: 'Resource conflict (e.g. duplicate email)',
        type: ApiErrorSwaggerDto,
      }),
    );
  }
  if (options.tooManyRequests) {
    decorators.push(
      ApiTooManyRequestsResponse({
        description: 'Rate limit exceeded',
        type: ApiErrorSwaggerDto,
      }),
    );
  }
  if (options.badGateway !== false) {
    decorators.push(
      ApiBadGatewayResponse({
        description: 'Downstream microservice unavailable or returned an upstream error',
        type: ApiErrorSwaggerDto,
      }),
    );
  }

  return applyDecorators(...decorators);
}

export function ApiUuidParam(name: string, description: string): MethodDecorator {
  return ApiParam({ name, format: 'uuid', description });
}

export function ApiSseStreamResponse(description: string): MethodDecorator {
  return applyDecorators(
    ApiProduces('text/event-stream'),
    ApiOkResponse({
      description,
      schema: {
        type: 'string',
        description:
          'Newline-delimited SSE frames (`data: {"type":"user_message"|"delta"|"done"|"error",...}\\n\\n`)',
      },
    }),
  );
}
