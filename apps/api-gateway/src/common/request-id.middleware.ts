import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const VALID_REQUEST_ID_REGEX = /^[\w.-]{1,128}$/;

/**
 * Propagates a validated incoming `x-request-id` or generates a fresh UUID,
 * setting `X-Request-Id` on every HTTP response including guard rejections.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header('x-request-id');
    const id = incoming && VALID_REQUEST_ID_REGEX.test(incoming) ? incoming : randomUUID();
    req.headers['x-request-id'] = id;
    res.setHeader('X-Request-Id', id);
    next();
  }
}
