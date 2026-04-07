import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import {
  chainExpressMiddleware,
  wrapExpressMiddleware,
} from '@middlewares/wrap';
import {
  enforceTenantMiddleware,
  tenantMiddleware,
} from '@middlewares/tenant.middleware';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantRequestContextLogMiddleware } from '@middlewares/tenant-request-log.middleware';
import {
  blockNonAdminWrites,
  requireAdmin,
} from '@middlewares/admin.middleware';
import { rlsContextMiddleware } from '@middlewares/rls.middleware';
import { bindRequestToRlsTransaction } from '@middlewares/request-rls-transaction.middleware';
import { auditLog } from '@middlewares/audit.middleware';

export const TenantMiddlewareNest = wrapExpressMiddleware(tenantMiddleware);

export const StandardProtectedMiddleware = chainExpressMiddleware(
  authMiddleware,
  enforceTenantMiddleware,
  tenantRequestContextLogMiddleware,
  blockNonAdminWrites,
  rlsContextMiddleware,
  bindRequestToRlsTransaction,
  auditLog,
);

export const LoginSessionMiddleware = chainExpressMiddleware(
  authMiddleware,
  enforceTenantMiddleware,
  rlsContextMiddleware,
  bindRequestToRlsTransaction,
);

export const LoginSessionWithBlockAuditMiddleware = chainExpressMiddleware(
  authMiddleware,
  enforceTenantMiddleware,
  rlsContextMiddleware,
  bindRequestToRlsTransaction,
  blockNonAdminWrites,
  auditLog,
);

export const LoginResetPasswordMiddleware = chainExpressMiddleware(
  authMiddleware,
  requireAdmin,
  enforceTenantMiddleware,
  rlsContextMiddleware,
  bindRequestToRlsTransaction,
);

export const loginSessionHandlers: RequestHandler[] = [
  authMiddleware,
  enforceTenantMiddleware,
  rlsContextMiddleware,
  bindRequestToRlsTransaction,
];

export const loginSessionBlockAuditHandlers: RequestHandler[] = [
  ...loginSessionHandlers,
  blockNonAdminWrites,
  auditLog,
];

export const adminPanelLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  message: {
    error: 'Muitas requisições no painel admin. Tente novamente em breve.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const AdminPanelLimiterNest = wrapExpressMiddleware(adminPanelLimiter);
export const RequireAdminNest = wrapExpressMiddleware(requireAdmin);
