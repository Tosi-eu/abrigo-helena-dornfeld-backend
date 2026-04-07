import type { Response } from 'express';
import type { AuthRequest } from '@middlewares/auth.middleware';
import { PrismaTenantRepository } from '@repositories/tenant.repository';
import { PrismaTenantConfigRepository } from '@repositories/tenant-config.repository';
import { PrismaContractPortfolioRepository } from '@repositories/contract-portfolio.repository';
import {
  DEFAULT_TENANT_MODULES,
  TenantConfigService,
} from '@services/tenant-config.service';
import { getErrorMessage } from '@domain/error.types';

const tenantRepo = new PrismaTenantRepository();
const portfolioRepo = new PrismaContractPortfolioRepository();
const configRepo = new PrismaTenantConfigRepository();
const configService = new TenantConfigService(configRepo);

export class AdminTenantsController {
  async listTenants(req: AuthRequest, res: Response) {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
      const result = await tenantRepo.list(page, limit);
      return res.json({
        ...result,
        data: result.data.map(t => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          brandName: t.brand_name ?? null,
          logoUrl: t.logo_url ?? null,
          contractPortfolioId: t.contract_portfolio_id ?? null,
        })),
      });
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
      const ccRaw = req.body?.contract_code;
      let contract_code_hash: string | null = null;
      let contract_portfolio_id: number | null = null;
      if (ccRaw != null && String(ccRaw).trim() !== '') {
        const resolved = await portfolioRepo.resolveOrCreateByPlainText(
          String(ccRaw).trim(),
        );
        contract_code_hash = resolved.hash;
        contract_portfolio_id = resolved.id;
      }
      const created = await tenantRepo.create({
        slug,
        name,
        contract_code_hash,
        contract_portfolio_id,
      });
      await configService.set(created.id, DEFAULT_TENANT_MODULES);
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
      if (!id || Number.isNaN(id))
        return res.status(400).json({ error: 'id inválido' });
      const slug =
        req.body?.slug != null ? String(req.body.slug).trim() : undefined;
      const name =
        req.body?.name != null ? String(req.body.name).trim() : undefined;
      const patch: Partial<{
        slug: string;
        name: string;
        contract_code_hash: string | null;
        contract_portfolio_id: number | null;
      }> = {};
      if (slug !== undefined) patch.slug = slug;
      if (name !== undefined) patch.name = name;
      if (req.body?.clear_contract_code === true) {
        patch.contract_code_hash = null;
        patch.contract_portfolio_id = null;
      } else if (
        req.body?.contract_code != null &&
        String(req.body.contract_code).trim() !== ''
      ) {
        const resolved = await portfolioRepo.resolveOrCreateByPlainText(
          String(req.body.contract_code).trim(),
        );
        patch.contract_code_hash = resolved.hash;
        patch.contract_portfolio_id = resolved.id;
      }
      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: 'Nada para atualizar' });
      }
      const updated = await tenantRepo.update(id, patch);
      return res.json(updated);
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ error: getErrorMessage(error) || 'Erro ao atualizar tenant' });
    }
  }

  async setContractCodeBySlug(req: AuthRequest, res: Response) {
    try {
      const slug = String(req.params.slug ?? '').trim();
      if (!slug) {
        return res.status(400).json({ error: 'slug obrigatório' });
      }
      const id = await tenantRepo.findIdBySlug(slug);

      if (req.body?.clear_contract_code === true) {
        if (!id) {
          return res.status(404).json({ error: 'Abrigo não encontrado' });
        }
        await tenantRepo.update(id, {
          contract_code_hash: null,
          contract_portfolio_id: null,
        });
        return res.json({ ok: true, slug, contractCodeConfigured: false });
      }

      const cc = req.body?.contract_code;
      if (cc == null || String(cc).trim() === '') {
        return res.status(400).json({
          error:
            'Envie contract_code (texto) ou clear_contract_code: true. Para criar um abrigo novo, contract_code é obrigatório.',
        });
      }

      const resolved = await portfolioRepo.resolveOrCreateByPlainText(
        String(cc).trim(),
      );

      if (!id) {
        const name = String(req.body?.name ?? '').trim() || slug;
        const created = await tenantRepo.create({
          slug,
          name,
          contract_code_hash: resolved.hash,
          contract_portfolio_id: resolved.id,
        });
        await configService.set(created.id, DEFAULT_TENANT_MODULES);
        return res.status(201).json({
          ok: true,
          slug,
          contractCodeConfigured: true,
          created: true,
          tenant: created,
        });
      }

      await tenantRepo.update(id, {
        contract_code_hash: resolved.hash,
        contract_portfolio_id: resolved.id,
      });
      return res.json({
        ok: true,
        slug,
        contractCodeConfigured: true,
        created: false,
      });
    } catch (error: unknown) {
      const msg = getErrorMessage(error) || '';
      if (
        msg.includes('duplicate') ||
        msg.includes('unique') ||
        msg.includes('23505')
      ) {
        return res.status(409).json({
          error: 'Já existe um abrigo com este slug',
        });
      }
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao definir código de contrato',
      });
    }
  }

  async deleteTenant(req: AuthRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id))
        return res.status(400).json({ error: 'id inválido' });
      if (id === 1)
        return res
          .status(400)
          .json({ error: 'Não é permitido remover o tenant padrão' });
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
