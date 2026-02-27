import { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';
import LoginModel from '../infrastructure/database/models/login.model';

const ADMIN_ROLE = 'admin';

/**
 * Restricts the route to users with role = 'admin'.
 * Use after authMiddleware. Returns 403 if the authenticated user is not admin.
 */
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

/**
 * For user creation only: allows the request if (1) authenticated and admin, or
 * (2) no users exist yet (bootstrap — first user becomes admin).
 */
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

/** @deprecated Use role === 'admin' instead. Kept for RLS (id 1 = admin in DB). */
export const ADMIN_USER_ID = 1;

/** Message returned for 403 when user lacks privilege to perform write operations. */
export const INSUFFICIENT_PRIVILEGES_MESSAGE =
  'Você não tem os privilégios necessários. Contate o administrador.';

/**
 * Blocks POST, PUT, PATCH, DELETE for non-admin users.
 * Use after authMiddleware on routes that perform write operations.
 * Returns 403 with INSUFFICIENT_PRIVILEGES_MESSAGE so the frontend can show a toast.
 */
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
