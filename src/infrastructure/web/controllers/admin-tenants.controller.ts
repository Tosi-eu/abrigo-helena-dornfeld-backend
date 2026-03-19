import type { Response } from 'express';
import type { AuthRequest } from '../../../middleware/auth.middleware';
import { TenantRepository } from '../../database/repositories/tenant.repository';
import { TenantConfigRepository } from '../../database/repositories/tenant-config.repository';
import { TenantConfigService } from '../../../core/services/tenant-config.service';
import { getErrorMessage } from '../../types/error.types';

const tenantRepo = new TenantRepository();
const configRepo = new TenantConfigRepository();
const configService = new TenantConfigService(configRepo);

export class AdminTenantsController {
  async listTenants(req: AuthRequest, res: Response) {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
      const result = await tenantRepo.list(page, limit);
      return res.json(result);
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ error: getErrorMessage(error) || 'Erro ao listar tenants' });
    }
  }

  async createTenant(req: AuthRequest, res: Response) {
    try {
      const slug = String(req.body?.slug || '').trim();
      const name = String(req.body?.name || '').trim();
      if (!slug || !name) {
        return res.status(400).json({ error: 'slug e name são obrigatórios' });
      }
      const created = await tenantRepo.create({ slug, name });
      // seed default config
      await configRepo.setByTenantId(created.id, {
        enabled: [
          'dashboard',
          'admin',
          'residents',
          'medicines',
          'inputs',
          'stock',
          'movements',
          'reports',
          'notifications',
        ],
      });
      return res.status(201).json(created);
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ error: getErrorMessage(error) || 'Erro ao criar tenant' });
    }
  }

  async updateTenant(req: AuthRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'id inválido' });
      const slug =
        req.body?.slug != null ? String(req.body.slug).trim() : undefined;
      const name =
        req.body?.name != null ? String(req.body.name).trim() : undefined;
      const updated = await tenantRepo.update(id, { slug, name });
      return res.json(updated);
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ error: getErrorMessage(error) || 'Erro ao atualizar tenant' });
    }
  }

  async deleteTenant(req: AuthRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'id inválido' });
      if (id === 1) return res.status(400).json({ error: 'Não é permitido remover o tenant padrão' });
      const ok = await tenantRepo.delete(id);
      return res.json({ ok });
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ error: getErrorMessage(error) || 'Erro ao remover tenant' });
    }
  }

  async getTenantConfig(req: AuthRequest, res: Response) {
    try {
      const tenantId = Number(req.params.id);
      if (!tenantId || Number.isNaN(tenantId)) {
        return res.status(400).json({ error: 'tenant id inválido' });
      }
      const cfg = await configService.get(tenantId);
      return res.json({ tenantId, modules: cfg });
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao carregar config do tenant',
      });
    }
  }

  async setTenantConfig(req: AuthRequest, res: Response) {
    try {
      const tenantId = Number(req.params.id);
      if (!tenantId || Number.isNaN(tenantId)) {
        return res.status(400).json({ error: 'tenant id inválido' });
      }
      const modules = await configService.set(tenantId, req.body?.modules);
      return res.json({ tenantId, modules });
    } catch (error: unknown) {
      return res.status(400).json({
        error: getErrorMessage(error) || 'Config inválida',
      });
    }
  }
}

