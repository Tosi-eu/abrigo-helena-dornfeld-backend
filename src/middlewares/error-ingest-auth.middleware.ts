import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';

/**
 * Aceita X-API-Key igual a `X_API_KEY` OU sessão JWT já resolvida por `optionalAuthMiddleware`.
 */
export function errorIngestAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const expected = process.env.X_API_KEY?.trim();
  const got = req.header('x-api-key')?.trim();
  if (expected && got && got === expected) {
    next();
    return;
  }
  if (req.user?.id) {
    next();
    return;
  }
  res.status(401).json({
    error: 'Autenticação necessária (Bearer/cookie ou X-API-Key)',
    code: 'ERROR_INGEST_UNAUTHORIZED',
  });
}
