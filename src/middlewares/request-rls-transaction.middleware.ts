import type { Response, NextFunction } from 'express';
import { prisma, runWithTransactionClient } from '@repositories/prisma';
import { setRlsSessionGucs } from '@repositories/rls.context';
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
      next();
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
  void prisma
    .$transaction(async tx => {
      await setRlsSessionGucs(tx, context);
      const pass: NextFunction = () => runWithTransactionClient(tx, () => next());
      await waitForResponse(res, pass);
    })
    .catch(next);
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
  void prisma
    .$transaction(async tx => {
      await setRlsSessionGucs(tx, {
        tenant_id: String(tenantId),
        is_super_admin: 'false',
      });
      const pass: NextFunction = () => runWithTransactionClient(tx, () => next());
      await waitForResponse(res, pass);
    })
    .catch(next);
}

export function bindSuperAdminRlsTransaction(
  _req: unknown,
  res: Response,
  next: NextFunction,
) {
  void prisma
    .$transaction(async tx => {
      await setRlsSessionGucs(tx, { is_super_admin: 'true' });
      const pass: NextFunction = () => runWithTransactionClient(tx, () => next());
      await waitForResponse(res, pass);
    })
    .catch(next);
}
