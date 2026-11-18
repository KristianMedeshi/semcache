import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const INTERNAL_HEADER_PREFIX = 'x-internal-';

@Injectable()
export class StripInternalHeadersMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    for (const headerName of Object.keys(req.headers)) {
      if (headerName.toLowerCase().startsWith(INTERNAL_HEADER_PREFIX)) {
        delete req.headers[headerName];
      }
    }
    next();
  }
}
