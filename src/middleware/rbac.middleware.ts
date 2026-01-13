import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

export type UserRole = 'admin' | 'user';

export interface RoleRequest extends AuthRequest {
  user?: {
    id: number;
    login: string;
    role?: UserRole;
  };
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: RoleRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const userRole: UserRole = (req.user.role as UserRole) || 'user';

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Acesso negado. Permissões insuficientes.',
      });
    }

    next();
  };
}

export const requireAdmin = requireRole('admin');

export function requireOwnership(
  getResourceUserId: (req: RoleRequest) => number | null,
) {
  return (req: RoleRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const resourceUserId = getResourceUserId(req);
    const userRole: UserRole = (req.user.role as UserRole) || 'user';

    if (userRole === 'admin') {
      return next();
    }

    if (resourceUserId === null || resourceUserId !== req.user.id) {
      return res.status(403).json({
        error: 'Acesso negado. Você só pode acessar seus próprios recursos.',
      });
    }

    next();
  };
}
