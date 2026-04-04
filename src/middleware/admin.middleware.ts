import { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';
import LoginModel from '../infrastructure/database/models/login.model';

const ADMIN_ROLE = 'admin';

export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.user?.role !== ADMIN_ROLE) {
    return res.status(403).json({
      error: 'Acesso negado. Apenas administradores podem realizar esta ação.',
    });
  }
  next();
}

export async function requireAdminOrBootstrap(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const count = await LoginModel.count();
  if (count === 0) return next();
  if (req.user?.role === ADMIN_ROLE) return next();
  return res.status(403).json({
    error: 'Acesso negado. Apenas administradores podem criar novos usuários.',
  });
}

export const ADMIN_USER_ID = 1;

export const INSUFFICIENT_PRIVILEGES_MESSAGE =
  'Você não tem os privilégios necessários. Contate o administrador.';

function isTenantSetupWrite(req: AuthRequest): boolean {
  if (!['PUT', 'PATCH', 'POST', 'DELETE'].includes(req.method)) return false;
  const path = (req.originalUrl || req.url || '').split('?')[0];
  return /\/tenant\/(?:config|branding)/.test(path);
}

export function blockNonAdminWrites(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.user?.role === ADMIN_ROLE) return next();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  return res.status(403).json({
    error: INSUFFICIENT_PRIVILEGES_MESSAGE,
  });
}
