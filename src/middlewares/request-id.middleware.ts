import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.header('x-request-id')?.trim();
  const id =
    incoming && incoming.length > 0 ? incoming.slice(0, 80) : randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
