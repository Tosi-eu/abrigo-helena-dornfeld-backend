import { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';
import type { RlsContextVars } from '../infrastructure/database/rls.context';
import type { Transaction } from 'sequelize';
import type { Sequelize } from 'sequelize';
import { withRlsContext } from '../infrastructure/database/rls.context';
import type { TenantRequest } from './tenant.middleware';

export interface RlsRequest extends AuthRequest {
  rlsContext?: RlsContextVars;
  transaction?: Transaction;
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
    const p = req.user.permissions;
    req.rlsContext = {
      current_user_id: req.user.id,
      user_can_create: p?.create ? 'true' : 'false',
      user_can_update: p?.update ? 'true' : 'false',
      user_can_delete: p?.delete ? 'true' : 'false',
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

export function withRls(sequelize: Sequelize, handler: RouteHandler) {
  return (req: RlsRequest, res: Response, next: NextFunction) => {
    const context = req.rlsContext ?? {};
    withRlsContext(sequelize, context, async transaction => {
      (req as RlsRequest).transaction = transaction;
      try {
        await handler(req, res, next);
      } catch (err) {
        next(err);
      }
    }).catch(next);
  };
}
