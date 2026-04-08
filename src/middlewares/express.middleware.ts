import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Type,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { RequestHandler } from 'express';
import { runExpressMiddleware } from '@helpers/run-express-middleware';

export function UseExpressMwGuard(
  ...middlewares: RequestHandler[]
): Type<CanActivate> {
  @Injectable()
  class ExpressMwGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const ctx = context.switchToHttp();
      const req = ctx.getRequest<Request>();
      const res = ctx.getResponse<Response>();
      for (const mw of middlewares) {
        await runExpressMiddleware(mw, req, res);
        if (res.headersSent) {
          return false;
        }
      }
      return true;
    }
  }
  return ExpressMwGuard;
}
