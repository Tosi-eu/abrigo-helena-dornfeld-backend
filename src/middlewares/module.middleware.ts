import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';
import { type TenantRequest, requireTenantId } from './tenant.middleware';
import { TenantConfigService } from '@services/tenant-config.service';
import { PrismaTenantConfigRepository } from '@repositories/tenant-config.repository';
import type { ModuleKey } from '@domain/tenant.types';

const service = new TenantConfigService(new PrismaTenantConfigRepository());

export function requireModule(moduleKey: ModuleKey) {
  return async (
    req: AuthRequest & TenantRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (tenantId === null) return;
      const cfg = await service.get(tenantId);
      if (!service.isEnabled(cfg, moduleKey)) {
        return res.status(403).json({
          error: `Módulo desabilitado para este tenant: ${moduleKey}`,
        });
      }
      next();
    } catch {
      return res
        .status(500)
        .json({ error: 'Erro ao validar módulos do tenant' });
    }
  };
}
