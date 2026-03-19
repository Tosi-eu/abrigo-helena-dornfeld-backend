import type { Response } from 'express';
import type { AuthRequest } from '../../../middleware/auth.middleware';
import type { TenantRequest } from '../../../middleware/tenant.middleware';
import { TenantConfigService } from '../../../core/services/tenant-config.service';
import { TenantConfigRepository } from '../../database/repositories/tenant-config.repository';
import { getErrorMessage } from '../../types/error.types';
import { TenantRepository } from '../../database/repositories/tenant.repository';

const service = new TenantConfigService(new TenantConfigRepository());
const tenantRepo = new TenantRepository();

export class TenantController {
  async getConfig(req: AuthRequest & TenantRequest, res: Response) {
    try {
      const tenantId = req.tenant?.id ?? 1;
      const cfg = await service.get(tenantId);
      const tenant = await tenantRepo.findById(tenantId);
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
      });
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao carregar configuração',
      });
    }
  }

  async updateConfig(req: AuthRequest & TenantRequest, res: Response) {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas admin pode editar módulos' });
      }
      const tenantId = req.tenant?.id ?? 1;
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
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas admin pode editar branding' });
      }
      const tenantId = req.tenant?.id ?? 1;
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

