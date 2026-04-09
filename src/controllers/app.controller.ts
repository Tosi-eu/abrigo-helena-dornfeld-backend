import type { TenantBrandingApiResponse } from '@porto-sdk/sdk';
import { createHash } from 'node:crypto';
import { Request, Response } from 'express';
import { withRlsContext } from '@repositories/rls.context';
import { PrismaTenantRepository } from '@repositories/tenant.repository';
import { PrismaContractPortfolioRepository } from '@repositories/contract-portfolio.repository';
import { verifyContractCode as matchContractCode } from '@helpers/contract-code.helper';
import {
  assertLogoUrlBelongsToOurR2,
  getPublicDefaultLogoUrl,
  invalidateTenantLogoResolveCacheForSlug,
  tryResolveTenantLogoPublicUrlFromR2,
} from '@services/r2-assets.service';

const TENANT_LOGO_PROXY_MAX_BYTES = 6 * 1024 * 1024;

const contractPortfolioRepo = new PrismaContractPortfolioRepository();

function weakTenantLogoEtag(
  slug: string,
  brandingUpdatedAt: string | null,
  logoUrl: string,
): string {
  const payload = `${slug}\0${brandingUpdatedAt ?? ''}\0${logoUrl}`;
  const h = createHash('sha256')
    .update(payload)
    .digest('base64url')
    .slice(0, 28);
  return `W/"tl-${h}"`;
}

function ifNoneMatchPrecludesSend(req: Request, etag: string): boolean {
  const raw = req.headers['if-none-match'];
  if (raw == null || raw === '') return false;
  const strip = (x: string) => x.trim().replace(/^W\//i, '').replace(/"/g, '');
  const server = strip(etag);
  for (const part of raw.split(',')) {
    if (strip(part) === server) return true;
  }
  return false;
}

export class AppController {
  constructor() {}

  async getStatus(req: Request, res: Response) {
    return res.status(200).json({ ok: true });
  }

  async getPublicAppConfig(_req: Request, res: Response) {
    const explicit = process.env.PUBLIC_DEFAULT_LOGO_URL?.trim();
    const defaultLogoUrl =
      explicit ||
      (process.env.NODE_ENV === 'development' ? '/default_logo.png' : null) ||
      getPublicDefaultLogoUrl();
    return res.status(200).json({ defaultLogoUrl });
  }

  async listTenants(req: Request, res: Response) {
    try {
      const q = req.query.q != null ? String(req.query.q) : '';
      const limit =
        req.query.limit != null ? Number(req.query.limit) : undefined;
      const rows = await withRlsContext(
        { allow_public_directory: 'true' },
        async trx => {
          const repo = new PrismaTenantRepository();
          return repo.listPublic({ q, limit }, trx);
        },
      );
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
      const branding = await withRlsContext(
        { allow_public_directory: 'true' },
        async trx => {
          const repo = new PrismaTenantRepository();
          const t = await repo.findPublicBrandingBySlug(slug, trx);
          if (!t) {
            const notFound: TenantBrandingApiResponse = { found: false };
            return notFound;
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
                trx,
              );
              if (persisted) {
                invalidateTenantLogoResolveCacheForSlug(t.slug);
              }
            }
          }
          const b: TenantBrandingApiResponse = {
            found: true,
            slug: t.slug,
            name: t.name,
            brandName: t.brandName ?? null,
            logoUrl,
            requiresContractCode: true,
            contractCodeMandatory: t.contractCodeMandatory,
          };
          return b;
        },
      );
      return res.status(200).json(branding);
    } catch {
      return res.status(500).json({ error: 'Erro ao carregar abrigo' });
    }
  }

  async streamTenantLogoBySlug(req: Request, res: Response) {
    try {
      const slug = String(req.params.slug ?? '').trim();
      if (!slug) {
        return res.status(400).end();
      }
      const { t, logoUrl: resolvedUrl } = await withRlsContext(
        { allow_public_directory: 'true' },
        async trx => {
          const repo = new PrismaTenantRepository();
          const row = await repo.findPublicBrandingBySlug(slug, trx);
          if (!row) return { t: null, logoUrl: null };
          let logoUrl = row.logoUrl ?? null;
          if (!logoUrl) {
            const fromR2 = await tryResolveTenantLogoPublicUrlFromR2({
              slug: row.slug,
              brandName: row.brandName ?? null,
              name: row.name,
            });
            if (fromR2) {
              logoUrl = fromR2;
              await repo.tryPersistLogoUrlFromR2Discovery(
                row.slug,
                fromR2,
                trx,
              );
            }
          }
          return { t: row, logoUrl };
        },
      );
      if (!t) {
        return res.status(404).end();
      }
      const logoUrl = resolvedUrl;
      if (!logoUrl || !assertLogoUrlBelongsToOurR2(logoUrl)) {
        return res.status(404).end();
      }

      const etag = weakTenantLogoEtag(
        t.slug,
        t.brandingUpdatedAt ?? null,
        logoUrl,
      );
      res.setHeader('ETag', etag);
      res.setHeader(
        'Cache-Control',
        'private, max-age=86400, stale-while-revalidate=604800',
      );

      if (ifNoneMatchPrecludesSend(req, etag)) {
        return res.status(304).end();
      }

      const upstream = await fetch(logoUrl, {
        redirect: 'follow',
        headers: { Accept: 'image/*' },
      });
      if (!upstream.ok) {
        return res.status(404).end();
      }
      const rawCt = upstream.headers.get('content-type') || '';
      let ct = rawCt.split(';')[0]?.trim() || '';
      if (!/^image\/(png|jpeg|gif|webp|svg\+xml)$/i.test(ct)) {
        const u = logoUrl.toLowerCase();
        if (u.endsWith('.png')) ct = 'image/png';
        else if (u.endsWith('.webp')) ct = 'image/webp';
        else if (u.endsWith('.gif')) ct = 'image/gif';
        else if (u.endsWith('.jpg') || u.endsWith('.jpeg')) ct = 'image/jpeg';
        else if (u.endsWith('.svg')) ct = 'image/svg+xml';
        else return res.status(404).end();
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.length > TENANT_LOGO_PROXY_MAX_BYTES) {
        return res.status(413).end();
      }
      res.setHeader('Content-Type', ct);
      return res.status(200).send(buf);
    } catch {
      return res.status(502).end();
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
      const plainTrim = plain.trim();
      const isProvisional = slug.startsWith('u-');

      const tenant = await withRlsContext(
        {
          allow_public_directory: 'true',
          is_super_admin: 'true',
        },
        async trx => {
          const repo = new PrismaTenantRepository();
          return repo.findContractVerifyPayloadBySlug(slug, trx);
        },
      );
      if (!tenant) {
        return res.status(404).json({ error: 'Abrigo não encontrado' });
      }

      const tenantHasContractBinding =
        Boolean(tenant.contract_code_hash) ||
        tenant.contract_portfolio_id != null;

      if (!plainTrim) {
        if (isProvisional) {
          return res.status(200).json({
            valid: false,
            contractCodeRequired: true,
            reason: 'missing',
          });
        }
        if (!tenantHasContractBinding) {
          return res.status(200).json({
            valid: true,
            contractCodeRequired: false,
          });
        }
        return res.status(200).json({
          valid: false,
          contractCodeRequired: true,
          reason: 'missing',
        });
      }

      const matchedPortfolio =
        await contractPortfolioRepo.findMatchingPortfolioByPlainText(plainTrim);
      if (!matchedPortfolio) {
        return res.status(200).json({
          valid: false,
          contractCodeRequired: true,
          reason: 'mismatch',
        });
      }

      if (isProvisional) {
        const canonical = await withRlsContext(
          {
            allow_public_directory: 'true',
            is_super_admin: 'true',
          },
          async trx => {
            const repo = new PrismaTenantRepository();
            return repo.findCanonicalTenantByPortfolioId(
              matchedPortfolio.id,
              tenant.id,
              trx,
            );
          },
        );
        if (!canonical) {
          return res.status(200).json({
            valid: false,
            contractCodeRequired: true,
            reason: 'no_canonical_tenant',
          });
        }
        return res.status(200).json({
          valid: true,
          contractCodeRequired: true,
          canonicalSlug: canonical.slug,
        });
      }

      if (tenant.contract_code_hash) {
        const verdict = await matchContractCode(
          tenant.contract_code_hash,
          plainTrim,
        );
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
      }

      if (tenant.contract_portfolio_id != null) {
        if (tenant.contract_portfolio_id === matchedPortfolio.id) {
          return res.status(200).json({
            valid: true,
            contractCodeRequired: true,
          });
        }
        return res.status(200).json({
          valid: false,
          contractCodeRequired: true,
          reason: 'mismatch',
        });
      }

      return res.status(200).json({
        valid: false,
        contractCodeRequired: true,
        reason: 'mismatch',
      });
    } catch {
      return res.status(500).json({ error: 'Erro ao verificar código' });
    }
  }

  async verifyContractCodeForSignup(req: Request, res: Response) {
    try {
      const body = req.body ?? {};
      const plain =
        body.contract_code != null
          ? String(body.contract_code)
          : body.contractCode != null
            ? String(body.contractCode)
            : '';
      const plainTrim = plain.trim();
      if (!plainTrim) {
        return res.status(200).json({ valid: false });
      }
      const ok = await contractPortfolioRepo.isUsableContractCodeForSignup(
        plainTrim,
      );
      return res.status(200).json({ valid: ok });
    } catch {
      return res.status(200).json({ valid: false });
    }
  }
}
