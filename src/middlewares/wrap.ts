import { Injectable, NestMiddleware, Type } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { RequestHandler } from 'express';

/**
 * Wraps a single Express-style middleware as NestMiddleware.
 */
export function wrapExpressMiddleware(mw: RequestHandler): Type<NestMiddleware> {
  @Injectable()
  class ExpressMiddlewareWrapper implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction): void {
      void Promise.resolve(mw(req, res, next)).catch(next);
    }
  }
  return ExpressMiddlewareWrapper;
}

/**
 * Chains Express middlewares in order (each must call next() to continue).
 */
export function chainExpressMiddleware(
  ...middlewares: RequestHandler[]
): Type<NestMiddleware> {
  @Injectable()
  class ChainedExpressMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction): void {
      let i = 0;
      const run = (err?: unknown): void => {
        if (err !== undefined && err !== null) {
          next(err as Error);
          return;
        }
        if (i >= middlewares.length) {
          next();
          return;
        }
        const mw = middlewares[i++];
        try {
          void Promise.resolve(mw(req, res, run)).catch(run);
        } catch (e) {
          run(e);
        }
      };
      run();
    }
  }
  return ChainedExpressMiddleware;
}
