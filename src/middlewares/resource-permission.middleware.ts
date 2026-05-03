import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';
import {
  INSUFFICIENT_PRIVILEGES_MESSAGE,
  isProvisionalContractClaimPost,
} from './admin.middleware';
import { resolveRoutePermission } from '@helpers/http-route-permission';
import { canCrud, canMovementTipo } from '@helpers/permission-matrix.resolver';
import type { EffectivePermissionMatrix } from '@domain/permission-matrix.types';

function isBypassUser(u: AuthRequest['user'] | undefined): boolean {
  if (!u) return false;
  if (u.isSuperAdmin) return true;
  if (u.isTenantOwner) return true;
  if (u.role === 'admin') return true;
  return false;
}

export function enforceResourcePermissions(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  if (isBypassUser(req.user)) {
    return next();
  }

  if (
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
    isProvisionalContractClaimPost(req)
  ) {
    return next();
  }

  const method = req.method;
  if (method === 'OPTIONS') {
    return next();
  }

  const matrix: EffectivePermissionMatrix | undefined =
    req.user.permissionMatrix;
  if (!matrix) {
    return res.status(403).json({ error: INSUFFICIENT_PRIVILEGES_MESSAGE });
  }

  const decision = resolveRoutePermission(
    method,
    String(req.originalUrl ?? req.url ?? ''),
    req.body,
  );

  if (decision.kind === 'deny_unknown') {
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next();
    }
    return res.status(403).json({ error: INSUFFICIENT_PRIVILEGES_MESSAGE });
  }

  if (decision.kind === 'movement_tipo') {
    const ok = canMovementTipo(matrix, decision.tipo);
    if (!ok) {
      return res.status(403).json({ error: INSUFFICIENT_PRIVILEGES_MESSAGE });
    }
    return next();
  }

  const ok = canCrud(matrix, decision.resource, decision.action);
  if (!ok) {
    return res.status(403).json({ error: INSUFFICIENT_PRIVILEGES_MESSAGE });
  }
  return next();
}
