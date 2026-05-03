import { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';
import type { RlsContextVars } from '@repositories/rls.context';
import type { Prisma } from '@prisma/client';
import { withRlsContext } from '@repositories/rls.context';
import type { TenantRequest } from './tenant.middleware';
import {
  matrixHasAnyCreate,
  matrixHasAnyDelete,
  matrixHasAnyUpdate,
} from '@helpers/permission-matrix.resolver';

export interface RlsRequest extends AuthRequest {
  rlsContext?: RlsContextVars;
  transaction?: Prisma.TransactionClient;
}

export function rlsContextMiddleware(
  req: RlsRequest & TenantRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.tenant?.id) {
    res.status(403).json({ error: 'Tenant não identificado' });
    return;
  }
  if (req.user?.id != null) {
    const m = req.user.permissionMatrix;
    const flat = req.user.permissions;
    const user_can_create =
      m != null ? matrixHasAnyCreate(m) : Boolean(flat?.create);
    const user_can_update =
      m != null ? matrixHasAnyUpdate(m) : Boolean(flat?.update);
    const user_can_delete =
      m != null ? matrixHasAnyDelete(m) : Boolean(flat?.delete);
    req.rlsContext = {
      current_user_id: req.user.id,
      user_can_create: user_can_create ? 'true' : 'false',
      user_can_update: user_can_update ? 'true' : 'false',
      user_can_delete: user_can_delete ? 'true' : 'false',
      tenant_id: String(req.tenant.id),
      is_super_admin: req.user.isSuperAdmin ? 'true' : 'false',
    };
  } else {
    req.rlsContext = { tenant_id: String(req.tenant.id) };
  }
  next();
}

type RouteHandler = (
  req: RlsRequest,
  res: Response,
  next?: NextFunction,
) => void | Promise<unknown>;

export function withRls(handler: RouteHandler) {
  return (req: RlsRequest, res: Response, next: NextFunction) => {
    const context = req.rlsContext ?? {};
    withRlsContext(context, async transaction => {
      (req as RlsRequest).transaction = transaction;
      try {
        await handler(req, res, next);
      } catch (err) {
        next(err);
      }
    }).catch(next);
  };
}
