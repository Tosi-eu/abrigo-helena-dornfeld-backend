import type { TenantConfigResponse, TenantProfile } from '@porto-sdk/sdk';
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
import { SystemConfigRepository } from '../../database/repositories/system-config.repository';
import { getErrorMessage } from '../../types/error.types';
import { inferImageContentTypeFromBuffer } from '../../helpers/image-mime.helper';
import { TenantRepository } from '../../database/repositories/tenant.repository';
import { uiDisplayFromConfigRow } from '../../helpers/ui-display.helper';
import TenantModel from '../../database/models/tenant.model';
import {
  assertLogoUrlBelongsToOurR2,
  deleteTenantLogoObjectsExceptKey,
  invalidateTenantLogoResolveCacheForSlug,
  isR2AssetsConfigured,
  uploadTenantLogoToR2,
} from '../../storage/r2-assets.service';

const configRepo = new TenantConfigRepository();
const service = new TenantConfigService(configRepo);
const tenantRepo = new TenantRepository();
const systemConfigRepo = new SystemConfigRepository();

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

function mapTenantRowToProfile(row: TenantModel | null): TenantProfile | null {
  if (!row) return null;
  const raw = row.getDataValue('updated_at') as
    | Date
    | string
    | null
    | undefined;
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
      const onboardingComplete = hasIdentity(tenant);

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
  ) {
    try {
      if (!isR2AssetsConfigured()) {
        return res.status(503).json({
          error:
            'Armazenamento de logos (R2) não configurado. Use as mesmas credenciais da conta; defina R2_ASSETS_BUCKET_NAME (ex.: porto-assets) e R2_PUBLIC_BASE_URL.',
        });
      }
      const tenantId = requireTenantId(req, res);
      if (tenantId === null) return;
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
}
