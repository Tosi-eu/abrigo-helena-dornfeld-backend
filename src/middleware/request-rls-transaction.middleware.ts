import type { Response, NextFunction } from 'express';
import {
  sequelize,
  sequelizeClsNamespace,
} from '../infrastructure/database/sequelize';
import { setRlsSessionGucs } from '../infrastructure/database/rls.context';
import type { RlsRequest } from './rls.middleware';
import type { TenantRequest } from './tenant.middleware';

function waitForResponse(res: Response, next: NextFunction): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (err?: unknown) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve();
    };
    res.on('finish', () => done());
    res.on('close', () => done());
    try {
      next((err?: unknown) => {
        if (err) done(err);
      });
    } catch (e) {
      done(e);
    }
  });
}

export function bindRequestToRlsTransaction(
  req: RlsRequest & TenantRequest,
  res: Response,
  next: NextFunction,
) {
  const context = req.rlsContext ?? {};
  sequelizeClsNamespace.bind(() => {
    void sequelize
      .transaction(async () => {
        await setRlsSessionGucs(sequelize, context);
        await waitForResponse(res, next);
      })
      .catch(next);
  })();
}

export function bindPublicTenantToRlsTransaction(
  req: TenantRequest,
  res: Response,
  next: NextFunction,
) {
  const tenantId = req.tenant?.id;
  if (tenantId == null) {
    res.status(403).json({ error: 'Tenant não identificado' });
    return;
  }
  sequelizeClsNamespace.bind(() => {
    void sequelize
      .transaction(async () => {
        await setRlsSessionGucs(sequelize, {
          tenant_id: String(tenantId),
          is_super_admin: 'false',
        });
        await waitForResponse(res, next);
      })
      .catch(next);
  })();
}

export function bindSuperAdminRlsTransaction(
  _req: unknown,
  res: Response,
  next: NextFunction,
) {
  sequelizeClsNamespace.bind(() => {
    void sequelize
      .transaction(async () => {
        await setRlsSessionGucs(sequelize, { is_super_admin: 'true' });
        await waitForResponse(res, next);
      })
      .catch(next);
  })();
}
