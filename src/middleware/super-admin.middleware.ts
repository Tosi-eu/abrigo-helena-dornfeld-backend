import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';

export function requireSuperAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user?.isSuperAdmin) {
    return res.status(403).json({
      error: 'Acesso negado. Apenas super-admin pode gerenciar tenants.',
    });
  }
  next();
}

