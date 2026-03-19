import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';
import type { TenantRequest } from './tenant.middleware';
import { TenantConfigService } from '../core/services/tenant-config.service';
import { TenantConfigRepository } from '../infrastructure/database/repositories/tenant-config.repository';
import type { ModuleKey } from '../core/types/tenant.types';

const service = new TenantConfigService(new TenantConfigRepository());

export function requireModule(moduleKey: ModuleKey) {
  return async (req: AuthRequest & TenantRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenant?.id ?? 1;
      const cfg = await service.get(tenantId);
      if (!service.isEnabled(cfg, moduleKey)) {
        return res.status(403).json({
          error: `Módulo desabilitado para este tenant: ${moduleKey}`,
        });
      }
      next();
    } catch {
      return res.status(500).json({ error: 'Erro ao validar módulos do tenant' });
    }
  };
}

