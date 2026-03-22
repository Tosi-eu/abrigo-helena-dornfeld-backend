import type { Response } from 'express';
import type { AuthRequest } from '../../../middleware/auth.middleware';
import { TenantRepository } from '../../database/repositories/tenant.repository';
import { TenantConfigRepository } from '../../database/repositories/tenant-config.repository';
import { TenantConfigService } from '../../../core/services/tenant-config.service';
import { getErrorMessage } from '../../types/error.types';
import { hashContractCode } from '../../helpers/contract-code.helper';

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
      const ccRaw = req.body?.contract_code;
      let contract_code_hash: string | null = null;
      if (ccRaw != null && String(ccRaw).trim() !== '') {
        contract_code_hash = await hashContractCode(String(ccRaw).trim());
        const other = await tenantRepo.findOtherTenantWithContractHash(
          null,
          contract_code_hash,
        );
        if (other) {
          return res.status(409).json({
            error: `Código de contrato já vinculado ao abrigo "${other.slug}". Cada abrigo deve ter código exclusivo.`,
          });
        }
      }
      const created = await tenantRepo.create({
        slug,
        name,
        contract_code_hash,
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
      }> = {};
      if (slug !== undefined) patch.slug = slug;
      if (name !== undefined) patch.name = name;
      if (req.body?.clear_contract_code === true) {
        patch.contract_code_hash = null;
      } else if (
        req.body?.contract_code != null &&
        String(req.body.contract_code).trim() !== ''
      ) {
        const hash = await hashContractCode(
          String(req.body.contract_code).trim(),
        );
        const other = await tenantRepo.findOtherTenantWithContractHash(
          id,
          hash,
        );
        if (other) {
          return res.status(409).json({
            error: `Código de contrato já vinculado ao abrigo "${other.slug}". Cada abrigo deve ter código exclusivo.`,
          });
        }
        patch.contract_code_hash = hash;
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

  /**
   * Define o código de contrato (hash) por slug, ou cria o abrigo se ainda não existir.
   * Body: `{ contract_code: string, name?: string }` ou `{ clear_contract_code: true }` (só se já existir).
   */
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
        await tenantRepo.update(id, { contract_code_hash: null });
        return res.json({ ok: true, slug, contractCodeConfigured: false });
      }

      const cc = req.body?.contract_code;
      if (cc == null || String(cc).trim() === '') {
        return res.status(400).json({
          error:
            'Envie contract_code (texto) ou clear_contract_code: true. Para criar um abrigo novo, contract_code é obrigatório.',
        });
      }

      const hash = await hashContractCode(String(cc).trim());

      const otherTenant = await tenantRepo.findOtherTenantWithContractHash(
        id,
        hash,
      );
      if (otherTenant) {
        return res.status(409).json({
          error: `Código de contrato já vinculado ao abrigo "${otherTenant.slug}". Cada abrigo deve ter código exclusivo.`,
        });
      }

      if (!id) {
        const name = String(req.body?.name ?? '').trim() || slug;
        const created = await tenantRepo.create({
          slug,
          name,
          contract_code_hash: hash,
        });
        return res.status(201).json({
          ok: true,
          slug,
          contractCodeConfigured: true,
          created: true,
          tenant: created,
        });
      }

      await tenantRepo.update(id, { contract_code_hash: hash });
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
