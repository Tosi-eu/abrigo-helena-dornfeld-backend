import { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';
import type { TenantRequest } from './tenant.middleware';
import { getDb } from '@repositories/prisma';

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
  const count = await getDb().login.count();
  if (count === 0) return next();
  if (req.user?.role === ADMIN_ROLE) return next();
  return res.status(403).json({
    error: 'Acesso negado. Apenas administradores podem criar novos usuários.',
  });
}

export const ADMIN_USER_ID = 1;

export const INSUFFICIENT_PRIVILEGES_MESSAGE =
  'Você não tem os privilégios necessários. Contate o administrador.';

function isProvisionalContractClaimPost(req: AuthRequest): boolean {
  if (req.method !== 'POST') return false;
  const path = String(req.path ?? '');
  const orig = String(req.originalUrl ?? '').split('?')[0] ?? '';
  const needle = '/tenant/contract-code/claim';
  const hit = path.includes(needle) || orig.includes(needle);
  if (!hit) return false;
  const slug = String(
    (req as AuthRequest & TenantRequest).tenant?.slug ?? '',
  ).trim();
  return slug.startsWith('u-');
}

export function blockNonAdminWrites(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.user?.role === ADMIN_ROLE) return next();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (isProvisionalContractClaimPost(req)) return next();

  return res.status(403).json({
    error: INSUFFICIENT_PRIVILEGES_MESSAGE,
  });
}
