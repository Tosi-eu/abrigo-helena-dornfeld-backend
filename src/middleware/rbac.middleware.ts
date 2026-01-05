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

/**
 * Basic RBAC middleware - checks if user has required role
 * Note: This is a basic implementation. In a production system, you would:
 * 1. Store roles in the database
 * 2. Load user role from database in auth middleware
 * 3. Implement more granular permissions
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: RoleRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // For now, default all users to 'user' role
    // TODO: Load role from database in auth middleware
    const userRole: UserRole = (req.user.role as UserRole) || 'user';

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Acesso negado. Permissões insuficientes.',
      });
    }

    next();
  };
}

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware to check if user can only access their own resources
 */
export function requireOwnership(
  getResourceUserId: (req: RoleRequest) => number | null,
) {
  return (req: RoleRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const resourceUserId = getResourceUserId(req);
    const userRole: UserRole = (req.user.role as UserRole) || 'user';

    // Admins can access any resource
    if (userRole === 'admin') {
      return next();
    }

    // Users can only access their own resources
    if (resourceUserId === null || resourceUserId !== req.user.id) {
      return res.status(403).json({
        error: 'Acesso negado. Você só pode acessar seus próprios recursos.',
      });
    }

    next();
  };
}

