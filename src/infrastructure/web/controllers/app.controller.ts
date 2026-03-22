import type { TenantBrandingApiResponse } from '@abrigo/sdk';
import { Request, Response } from 'express';
import { TenantRepository } from '../../database/repositories/tenant.repository';
import { verifyContractCode as matchContractCode } from '../../helpers/contract-code.helper';
import {
  invalidateTenantLogoResolveCacheForSlug,
  tryResolveTenantLogoPublicUrlFromR2,
} from '../../storage/r2-assets.service';

export class AppController {
  constructor() {}

  async getStatus(req: Request, res: Response) {
    return res.status(200).json({ ok: true });
  }

  async listTenants(req: Request, res: Response) {
    try {
      const q = req.query.q != null ? String(req.query.q) : '';
      const limit =
        req.query.limit != null ? Number(req.query.limit) : undefined;
      const repo = new TenantRepository();
      const rows = await repo.listPublic({ q, limit });
      return res.json({ data: rows });
    } catch {
      return res.status(500).json({ error: 'Erro ao listar abrigos' });
    }
  }

  async getTenantPublicBranding(req: Request, res: Response) {
    try {
      const slug = String(req.params.slug ?? '').trim();
      if (!slug) {
        return res.status(400).json({ error: 'Slug obrigatório' });
      }
      const repo = new TenantRepository();
      const t = await repo.findPublicBrandingBySlug(slug);
      if (!t) {
        const notFound: TenantBrandingApiResponse = { found: false };
        return res.status(200).json(notFound);
      }
      let logoUrl = t.logoUrl ?? null;
      if (!logoUrl) {
        const fromR2 = await tryResolveTenantLogoPublicUrlFromR2({
          slug: t.slug,
          brandName: t.brandName ?? null,
          name: t.name,
        });
        if (fromR2) {
          logoUrl = fromR2;
          const persisted = await repo.tryPersistLogoUrlFromR2Discovery(
            t.slug,
            fromR2,
          );
          if (persisted) {
            invalidateTenantLogoResolveCacheForSlug(t.slug);
          }
        }
      }
      const branding: TenantBrandingApiResponse = {
        found: true,
        slug: t.slug,
        name: t.name,
        brandName: t.brandName ?? null,
        logoUrl,
        requiresContractCode: true,
        contractCodeMandatory: t.contractCodeMandatory,
      };
      return res.status(200).json(branding);
    } catch {
      return res.status(500).json({ error: 'Erro ao carregar abrigo' });
    }
  }

  async verifyTenantContractCode(req: Request, res: Response) {
    try {
      const slug = String(req.params.slug ?? '').trim();
      if (!slug) {
        return res.status(400).json({ error: 'Slug obrigatório' });
      }
      const body = req.body ?? {};
      const plain =
        body.contract_code != null
          ? String(body.contract_code)
          : body.contractCode != null
            ? String(body.contractCode)
            : '';

      const repo = new TenantRepository();
      const tenant = await repo.findContractVerifyPayloadBySlug(slug);
      if (!tenant) {
        return res.status(404).json({ error: 'Abrigo não encontrado' });
      }

      const required = Boolean(tenant.contract_code_hash);
      if (!required) {
        return res.status(200).json({
          valid: true,
          contractCodeRequired: false,
        });
      }

      const verdict = await matchContractCode(tenant.contract_code_hash, plain);
      if (verdict === 'required') {
        return res.status(200).json({
          valid: false,
          contractCodeRequired: true,
          reason: 'missing',
        });
      }
      if (verdict === 'invalid') {
        return res.status(200).json({
          valid: false,
          contractCodeRequired: true,
          reason: 'mismatch',
        });
      }
      return res.status(200).json({
        valid: true,
        contractCodeRequired: true,
      });
    } catch {
      return res.status(500).json({ error: 'Erro ao verificar código' });
    }
  }
}
