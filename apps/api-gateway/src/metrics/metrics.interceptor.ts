import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type Observable, finalize } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    if (req.path === '/metrics') {
      return next.handle();
    }

    const startedAt = performance.now();
    const routeObj = req.route as { path?: unknown } | undefined;
    const route =
      typeof routeObj?.path === 'string'
        ? `${req.baseUrl ?? ''}${routeObj.path}`
        : (req.path ?? '/');

    return next.handle().pipe(
      finalize(() => {
        const durationSeconds = (performance.now() - startedAt) / 1000;
        this.metricsService.recordHttpRequest(req.method, route, res.statusCode, durationSeconds);
      }),
    );
  }
}
