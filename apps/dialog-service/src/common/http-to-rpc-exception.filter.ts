import { type ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseRpcExceptionFilter, RpcException } from '@nestjs/microservices';
import type { Observable } from 'rxjs';

/**
 * Translates NestJS `HttpException` instances into structured `RpcException` payloads
 * so status codes and error messages propagate cleanly across TCP transport.
 */
@Catch()
export class HttpToRpcExceptionFilter extends BaseRpcExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): Observable<unknown> {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const payload =
        typeof response === 'object' && response !== null
          ? (response as Record<string, unknown>)
          : { message: String(response) };

      return super.catch(
        new RpcException({
          ...payload,
          statusCode: exception.getStatus(),
        }),
        host,
      );
    }

    return super.catch(exception, host);
  }
}
