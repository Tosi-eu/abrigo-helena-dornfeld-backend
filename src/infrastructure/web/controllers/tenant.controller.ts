import type { Response } from 'express';
import type { AuthRequest } from '../../../middleware/auth.middleware';
import {
  type TenantRequest,
  requireTenantId,
} from '../../../middleware/tenant.middleware';
import {
  DEFAULT_TENANT_MODULES,
  TenantConfigService,
} from '../../../core/services/tenant-config.service';
import { TenantConfigRepository } from '../../database/repositories/tenant-config.repository';
import { getErrorMessage } from '../../types/error.types';
import { TenantRepository } from '../../database/repositories/tenant.repository';

const configRepo = new TenantConfigRepository();
const service = new TenantConfigService(configRepo);
const tenantRepo = new TenantRepository();

function assertCanUpdateModules(req: AuthRequest): boolean {
  return req.user?.role === 'admin' || Boolean(req.user?.isSuperAdmin);
}

async function assertCanUpdateBranding(
  req: AuthRequest,
  tenantId: number,
): Promise<boolean> {
  if (req.user?.role === 'admin' || req.user?.isSuperAdmin) return true;
  const tenant = await tenantRepo.findById(tenantId);
  const noBrandIdentity =
    !String(tenant?.brand_name ?? '').trim() &&
    !String(tenant?.logo_data_url ?? '').trim();
  return noBrandIdentity;
}

export class TenantController {
  async getConfig(req: AuthRequest & TenantRequest, res: Response) {
    try {
      const tenantId = requireTenantId(req, res);
      if (tenantId === null) return;
      let cfgRow = await configRepo.getByTenantId(tenantId);
      if (!cfgRow) {
        await service.set(tenantId, DEFAULT_TENANT_MODULES);
        cfgRow = await configRepo.getByTenantId(tenantId);
      }
      const cfg = await service.get(tenantId);
      const tenant = await tenantRepo.findById(tenantId);
      const hasIdentity = Boolean(
        String(tenant?.brand_name ?? '').trim() ||
        String(tenant?.logo_data_url ?? '').trim(),
      );
      const onboardingComplete = hasIdentity;

      return res.json({
        tenantId,
        tenant: tenant
          ? {
              id: tenant.id,
              slug: tenant.slug,
              name: tenant.name,
              brandName: tenant.brand_name ?? null,
              logoDataUrl: tenant.logo_data_url ?? null,
            }
          : null,
        modules: cfg,
        modulesConfigured: Boolean(cfgRow?.modules_json),
        onboardingComplete,
      });
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao carregar configuração',
      });
    }
  }

  async updateConfig(req: AuthRequest & TenantRequest, res: Response) {
    try {
      const tenantId = requireTenantId(req, res);
      if (tenantId === null) return;
      if (!assertCanUpdateModules(req)) {
        return res.status(403).json({
          error:
            'Apenas administradores do painel (ou super admin) podem alterar os módulos do sistema.',
        });
      }
      const modules = await service.set(tenantId, req.body?.modules);
      return res.json({ tenantId, modules });
    } catch (error: unknown) {
      return res.status(400).json({
        error: getErrorMessage(error) || 'Config inválida',
      });
    }
  }

  async updateBranding(req: AuthRequest & TenantRequest, res: Response) {
    try {
      const tenantId = requireTenantId(req, res);
      if (tenantId === null) return;
      if (!(await assertCanUpdateBranding(req, tenantId))) {
        return res.status(403).json({
          error:
            'Apenas administradores podem alterar a identidade visual após a configuração inicial.',
        });
      }
      const brandNameRaw =
        req.body?.brandName != null ? String(req.body.brandName).trim() : null;
      const logoDataUrlRaw =
        req.body?.logoDataUrl != null ? String(req.body.logoDataUrl) : null;

      if (brandNameRaw && brandNameRaw.length > 160) {
        return res.status(400).json({ error: 'brandName muito longo' });
      }
      if (logoDataUrlRaw && logoDataUrlRaw.length > 800_000) {
        return res.status(400).json({ error: 'logo muito grande' });
      }
      if (logoDataUrlRaw && !logoDataUrlRaw.startsWith('data:image/')) {
        return res.status(400).json({ error: 'logoDataUrl inválido' });
      }

      const updated = await tenantRepo.updateBranding(tenantId, {
        brand_name: brandNameRaw || null,
        logo_data_url: logoDataUrlRaw || null,
      });

      return res.json({
        tenantId,
        tenant: updated
          ? {
              id: updated.id,
              slug: updated.slug,
              name: updated.name,
              brandName: updated.brand_name ?? null,
              logoDataUrl: updated.logo_data_url ?? null,
            }
          : null,
      });
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao atualizar branding',
      });
    }
  }
}
