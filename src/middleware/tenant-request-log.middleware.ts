import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';
import type { TenantRequest } from './tenant.middleware';
import { logger } from '../infrastructure/helpers/logger.helper';

/**
 * Registo estruturado com tenant + utilizador autenticado (suporte / auditoria leve).
 * Ative LOG_HTTP_TENANT=1 para nível `info`; caso contrário usa `debug` (só com LOG_LEVEL=debug).
 */
export function tenantRequestContextLogMiddleware(
  req: AuthRequest & TenantRequest,
  _res: Response,
  next: NextFunction,
): void {
  const tenant = req.tenant;
  const user = req.user;
  if (!tenant?.id || !user?.id) {
    next();
    return;
  }

  const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
  const payload = {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    userId: user.id,
    login: user.login,
    method: req.method,
    path,
  };

  if (process.env.LOG_HTTP_TENANT === '1') {
    logger.info('http_request', payload);
  } else {
    logger.debug('http_request', payload);
  }

  next();
}
