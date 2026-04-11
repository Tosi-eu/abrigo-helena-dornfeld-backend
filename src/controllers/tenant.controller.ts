import type { TenantConfigResponse, TenantProfile } from '@porto-sdk/sdk';
import type { Response } from 'express';
import type { AuthRequest } from '@middlewares/auth.middleware';
import { type TenantRequest } from '@middlewares/tenant.middleware';
import {
  DEFAULT_TENANT_MODULES,
  TenantConfigService,
} from '@services/tenant-config.service';
import { PrismaTenantConfigRepository } from '@repositories/tenant-config.repository';
import { PrismaSetorRepository } from '@repositories/setor.repository';
import { PrismaSystemConfigRepository } from '@repositories/system-config.repository';
import { getErrorMessage, HttpError, isHttpError } from '@domain/error.types';
import { inferImageContentTypeFromBuffer } from '@helpers/image-mime.helper';
import { PrismaTenantRepository } from '@repositories/tenant.repository';
import { uiDisplayFromConfigRow } from '@helpers/ui-display.helper';
import { withRootTransaction } from '@repositories/prisma';
import type { Prisma } from '@prisma/client';
import { invalidateAuthCacheForRequest } from '@helpers/auth-token-cache.helper';
import { migrateProvisionalLoginToCanonicalTenant } from '@services/tenant-contract-migration.service';
import { PrismaLoginRepository } from '@repositories/login.repository';
import { PrismaContractPortfolioRepository } from '@repositories/contract-portfolio.repository';
import {
  assertLogoUrlBelongsToOurR2,
  deleteTenantLogoObjectsExceptKey,
  invalidateTenantLogoResolveCacheForSlug,
  isR2AssetsConfigured,
  uploadTenantLogoToR2,
} from '@services/r2-assets.service';

const configRepo = new PrismaTenantConfigRepository();
const setorRepo = new PrismaSetorRepository();
const service = new TenantConfigService(configRepo, setorRepo);
const tenantRepo = new PrismaTenantRepository();
const systemConfigRepo = new PrismaSystemConfigRepository();
const contractPortfolioRepo = new PrismaContractPortfolioRepository();
const loginRepo = new PrismaLoginRepository();

const FULL_PERMISSIONS = {
  read: true,
  create: true,
  update: true,
  delete: true,
} as const;

type UiDisplayPayload = {
  casela: 'numero' | 'nome';
  caselaSetor: 'farmacia' | 'enfermagem' | 'todos';
  armario: 'numero' | 'categoria';
  gaveta: 'numero' | 'categoria';
};

async function loadUiDisplayForPayload(): Promise<UiDisplayPayload> {
  const all = await systemConfigRepo.getAll();
  const u = uiDisplayFromConfigRow(all);
  return {
    casela: u.casela,
    caselaSetor: u.caselaSetor,
    armario: u.armario,
    gaveta: u.gaveta,
  };
}

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
    !String(tenant?.logo_url ?? '').trim();
  return noBrandIdentity;
}

function hasIdentity(
  tenant: {
    brand_name?: string | null;
    logo_url?: string | null;
  } | null,
): boolean {
  return Boolean(
    String(tenant?.brand_name ?? '').trim() ||
    String(tenant?.logo_url ?? '').trim(),
  );
}

type TenantRowForProfile = {
  id: number;
  slug: string;
  name: string;
  brand_name: string | null;
  logo_url: string | null;
  updated_at: Date;
} | null;

function mapTenantRowToProfile(row: TenantRowForProfile): TenantProfile | null {
  if (!row) return null;
  const raw = row.updated_at;
  const brandingUpdatedAt =
    raw instanceof Date ? raw.toISOString() : raw ? String(raw) : null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brandName: row.brand_name ?? null,
    logoUrl: row.logo_url ?? null,
    brandingUpdatedAt,
  } as TenantProfile;
}

export class TenantController {
  async getConfig(
    req: AuthRequest & TenantRequest,
    res: Response,
    tenantId: number,
  ) {
    try {
      let cfgRow = await configRepo.getByTenantId(tenantId);
      if (!cfgRow) {
        await service.set(tenantId, DEFAULT_TENANT_MODULES);
        cfgRow = await configRepo.getByTenantId(tenantId);
      }
      const cfg = await service.get(tenantId);
      const tenant = await tenantRepo.findById(tenantId);
      const onboardingComplete =
        tenant?.slug === 'viewer' || hasIdentity(tenant);

      const tenantProfile = mapTenantRowToProfile(tenant);

      const uiDisplay = await loadUiDisplayForPayload();

      const payload: TenantConfigResponse & { uiDisplay: UiDisplayPayload } = {
        tenantId,
        tenant: tenantProfile,
        modules: cfg,
        modulesConfigured: Boolean(cfgRow?.modules_json),
        onboardingComplete,
        uiDisplay,
      };
      return res.json(payload);
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao carregar configuração',
      });
    }
  }

  async updateConfig(
    req: AuthRequest & TenantRequest,
    res: Response,
    tenantId: number,
  ) {
    try {
      if (!assertCanUpdateModules(req)) {
        return res.status(403).json({
          error:
            'Apenas administradores do painel (ou super admin) podem alterar os módulos do sistema.',
        });
      }
      const modules = await service.set(tenantId, req.body?.modules);
      const updated: Pick<TenantConfigResponse, 'tenantId' | 'modules'> = {
        tenantId,
        modules,
      };
      return res.json(updated);
    } catch (error: unknown) {
      return res.status(400).json({
        error: getErrorMessage(error) || 'Config inválida',
      });
    }
  }

  async uploadLogo(
    req: AuthRequest & TenantRequest & { file?: Express.Multer.File },
    res: Response,
    tenantId: number,
  ) {
    try {
      if (!isR2AssetsConfigured()) {
        return res.status(503).json({
          error:
            'Armazenamento de logos (R2) não configurado. Use as mesmas credenciais da conta; defina R2_ASSETS_BUCKET_NAME (ex.: porto-assets) e R2_PUBLIC_BASE_URL.',
        });
      }
      if (!(await assertCanUpdateBranding(req, tenantId))) {
        return res.status(403).json({
          error:
            'Apenas administradores podem alterar o logo após a configuração inicial.',
        });
      }
      const file = req.file;
      if (!file?.buffer?.length) {
        return res.status(400).json({ error: 'Arquivo de imagem obrigatório' });
      }
      const allowedMime = [
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
      ] as const;
      let contentType = file.mimetype;
      if (!allowedMime.includes(contentType as (typeof allowedMime)[number])) {
        const inferred = inferImageContentTypeFromBuffer(file.buffer);
        if (
          inferred &&
          allowedMime.includes(inferred as (typeof allowedMime)[number])
        ) {
          contentType = inferred;
        } else {
          return res
            .status(400)
            .json({ error: 'Use imagem PNG, JPEG, WebP ou GIF' });
        }
      }

      const tenantRow = await tenantRepo.findById(tenantId);
      if (!tenantRow?.slug) {
        return res.status(404).json({ error: 'Tenant não encontrado' });
      }
      const brandFromBody =
        req.body?.brandName != null ? String(req.body.brandName).trim() : '';
      const brandForKey =
        brandFromBody ||
        String(tenantRow.brand_name ?? '').trim() ||
        String(tenantRow.name ?? '').trim() ||
        'logo';

      const oldBrandForCleanup =
        String(tenantRow.brand_name ?? '').trim() ||
        String(tenantRow.name ?? '').trim() ||
        'logo';
      const brandSegmentsForR2 = Array.from(
        new Set([oldBrandForCleanup, brandForKey]),
      );

      const { key: newObjectKey, publicUrl } = await uploadTenantLogoToR2({
        slug: tenantRow.slug,
        brandName: brandForKey,
        buffer: file.buffer,
        contentType,
      });

      await deleteTenantLogoObjectsExceptKey({
        slug: tenantRow.slug,
        keepKey: newObjectKey,
        brandNameSegmentsToScan: brandSegmentsForR2,
        previousLogoUrlFromDb: tenantRow.logo_url ?? null,
      });

      invalidateTenantLogoResolveCacheForSlug(tenantRow.slug);

      return res.status(201).json({ logoUrl: publicUrl });
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      if (msg?.includes('não permitido')) {
        return res.status(400).json({ error: msg });
      }
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao enviar logo',
      });
    }
  }

  async updateBranding(
    req: AuthRequest & TenantRequest,
    res: Response,
    tenantId: number,
  ) {
    try {
      const before = await tenantRepo.findById(tenantId);
      if (!(await assertCanUpdateBranding(req, tenantId))) {
        return res.status(403).json({
          error:
            'Apenas administradores podem alterar a identidade visual após a configuração inicial.',
        });
      }
      const brandNameRaw =
        req.body?.brandName != null ? String(req.body.brandName).trim() : null;
      const logoUrlRaw =
        req.body?.logoUrl != null ? String(req.body.logoUrl).trim() : null;

      if (brandNameRaw && brandNameRaw.length > 160) {
        return res.status(400).json({ error: 'brandName muito longo' });
      }
      if (logoUrlRaw) {
        if (logoUrlRaw.length > 2048) {
          return res.status(400).json({ error: 'logoUrl muito longo' });
        }
        if (!logoUrlRaw.startsWith('https://')) {
          return res.status(400).json({ error: 'logoUrl deve ser HTTPS' });
        }
        if (!assertLogoUrlBelongsToOurR2(logoUrlRaw)) {
          return res.status(400).json({
            error: 'logoUrl inválido para este ambiente',
          });
        }
      }

      const hasUrl = Object.prototype.hasOwnProperty.call(req.body, 'logoUrl');
      if (hasUrl && !logoUrlRaw) {
        return res.status(400).json({
          error: 'logoUrl não pode ser vazio. Envie um logo e tente novamente.',
        });
      }

      const patch: {
        brand_name: string | null;
        logo_url: string | null;
      } = {
        brand_name: brandNameRaw || null,
        logo_url: null,
      };

      if (hasUrl) {
        patch.logo_url = logoUrlRaw || null;
      } else {
        const current = await tenantRepo.findById(tenantId);
        patch.logo_url = current?.logo_url ?? null;
      }

      const updated = await tenantRepo.updateBranding(tenantId, patch);

      const tenantAfter = mapTenantRowToProfile(updated);

      const noIdentityBefore = !hasIdentity(before);
      const hasIdentityAfter = hasIdentity(updated);
      const isProvisional = String(updated?.slug ?? '').startsWith('u-');
      if (
        noIdentityBefore &&
        hasIdentityAfter &&
        isProvisional &&
        req.user?.id != null &&
        req.user?.role === 'user'
      ) {
        await loginRepo.update(req.user.id, {
          tenant_id: tenantId,
          role: 'admin',
          permissions: { ...FULL_PERMISSIONS } as Prisma.InputJsonValue,
        });
        await invalidateAuthCacheForRequest(req);
      }

      const brandingRes: Pick<TenantConfigResponse, 'tenantId' | 'tenant'> = {
        tenantId,
        tenant: tenantAfter,
      };
      return res.json(brandingRes);
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao atualizar branding',
      });
    }
  }

  async setContractCode(
    req: AuthRequest & TenantRequest,
    res: Response,
    tenantId: number,
  ) {
    try {
      if (req.user?.role !== 'admin' && !req.user?.isSuperAdmin) {
        return res.status(403).json({
          error: 'Apenas administradores podem definir o código de contrato.',
        });
      }
      const codeRaw = req.body?.contract_code ?? req.body?.contractCode;
      const code = codeRaw != null ? String(codeRaw).trim() : '';
      if (!code) {
        return res.status(400).json({ error: 'Informe contract_code (texto)' });
      }

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant)
        return res.status(404).json({ error: 'Tenant não encontrado' });
      if (String(tenant.slug ?? '') === 'viewer') {
        return res.status(400).json({ error: 'Tenant inválido para contrato' });
      }

      const resolved =
        await contractPortfolioRepo.resolveOrCreateByPlainText(code);

      const provisionalSlug = String(tenant.slug ?? '');
      const isProvisional = provisionalSlug.startsWith('u-');

      const canonical = await tenantRepo.findCanonicalTenantByPortfolioId(
        resolved.id,
        tenantId,
      );

      if (canonical && isProvisional && req.user?.id != null) {
        const sessionUser = req.user;
        if (!sessionUser) {
          return res.status(401).json({ error: 'Sessão inválida' });
        }
        try {
          await migrateProvisionalLoginToCanonicalTenant({
            sessionUser,
            provisionalTenantId: tenantId,
            canonicalTenantId: canonical.id,
          });
        } catch (err: unknown) {
          if (isHttpError(err)) throw err;
          const msg = getErrorMessage(err);
          if (
            msg.includes('foreign key') ||
            msg.includes('violates foreign key constraint')
          ) {
            throw new HttpError(
              'O abrigo temporário ainda tem dados associados e não pôde ser removido. Contate o suporte.',
              409,
            );
          }
          throw err;
        }

        await invalidateAuthCacheForRequest(req);
        await invalidateTenantLogoResolveCacheForSlug(provisionalSlug);
        const afterCanon = await tenantRepo.findById(canonical.id);
        return res.status(200).json({
          ok: true,
          migrated: true,
          tenantId: canonical.id,
          tenantSlug: afterCanon?.slug ?? canonical.slug,
        });
      }

      await tenantRepo.setContractCodeForTenant(tenantId, {
        contract_code_hash: resolved.hash,
        contract_portfolio_id: resolved.id,
      });
      // Marca como "usado" quando o código é vinculado a um abrigo definitivo.
      // Isso impede reutilização do mesmo contrato para outro abrigo (por padrão).
      await withRootTransaction(async t => {
        // Usa SQL direto para não depender de `prisma generate` para os novos campos
        // (used_by_tenant_id/used_at/disabled_at) no client durante deploy.
        await t.$executeRaw`
          UPDATE contract_portfolio
          SET used_by_tenant_id = ${tenantId}, used_at = NOW()
          WHERE id = ${resolved.id}
            AND disabled_at IS NULL
            AND used_by_tenant_id IS NULL
        `;
      });
      return res.status(200).json({ ok: true, migrated: false });
    } catch (error: unknown) {
      if (isHttpError(error)) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(400).json({
        error: getErrorMessage(error) || 'Erro ao definir código de contrato',
      });
    }
  }
  async claimContractCode(
    req: AuthRequest & TenantRequest,
    res: Response,
    tenantId: number,
  ) {
    try {
      if (req.user?.id == null) {
        return res.status(401).json({ error: 'Sessão inválida' });
      }

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant)
        return res.status(404).json({ error: 'Tenant não encontrado' });
      const provisionalSlug = String(tenant.slug ?? '');
      if (!provisionalSlug.startsWith('u-')) {
        return res.status(400).json({
          error:
            'Este endpoint só se aplica a abrigos temporários (identificador u-…).',
        });
      }
      if (String(provisionalSlug) === 'viewer') {
        return res.status(400).json({ error: 'Tenant inválido para contrato' });
      }

      const codeRaw = req.body?.contract_code ?? req.body?.contractCode;
      const code = codeRaw != null ? String(codeRaw).trim() : '';
      if (!code) {
        return res.status(400).json({ error: 'Informe contract_code (texto)' });
      }

      const matched =
        await contractPortfolioRepo.findMatchingPortfolioByPlainText(code);
      if (!matched) {
        return res.status(404).json({
          error: 'Código de contrato não encontrado ou inválido.',
        });
      }

      const canonical = await tenantRepo.findCanonicalTenantByPortfolioId(
        matched.id,
        tenantId,
      );
      if (!canonical) {
        return res.status(404).json({
          error:
            'O código existe, mas ainda não há um abrigo definitivo associado. Aguarde o cadastro pela equipa Stokio.',
        });
      }

      const sessionUser = req.user;
      try {
        await migrateProvisionalLoginToCanonicalTenant({
          sessionUser,
          provisionalTenantId: tenantId,
          canonicalTenantId: canonical.id,
        });
      } catch (err: unknown) {
        if (isHttpError(err)) throw err;
        const msg = getErrorMessage(err);
        if (
          msg.includes('foreign key') ||
          msg.includes('violates foreign key constraint')
        ) {
          throw new HttpError(
            'O abrigo temporário ainda tem dados associados e não pôde ser removido. Contate o suporte.',
            409,
          );
        }
        throw err;
      }

      await invalidateAuthCacheForRequest(req);
      await invalidateTenantLogoResolveCacheForSlug(provisionalSlug);
      const afterCanon = await tenantRepo.findById(canonical.id);
      return res.status(200).json({
        ok: true,
        migrated: true,
        tenantId: canonical.id,
        tenantSlug: afterCanon?.slug ?? canonical.slug,
      });
    } catch (error: unknown) {
      if (isHttpError(error)) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(400).json({
        error:
          getErrorMessage(error) ||
          'Erro ao associar o código de contrato ao abrigo definitivo',
      });
    }
  }
}
