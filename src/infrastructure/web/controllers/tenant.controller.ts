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
import {
  getErrorMessage,
  HttpError,
  isHttpError,
} from '../../types/error.types';
import { inferImageContentTypeFromBuffer } from '../../helpers/image-mime.helper';
import { TenantRepository } from '../../database/repositories/tenant.repository';
import { uiDisplayFromConfigRow } from '../../helpers/ui-display.helper';
import TenantModel from '../../database/models/tenant.model';
import TenantConfigModel from '../../database/models/tenant-config.model';
import TenantInviteModel from '../../database/models/tenant-invite.model';
import LoginModel from '../../database/models/login.model';
import { sequelize } from '../../database/sequelize';
import { Op } from 'sequelize';
import { invalidateAuthCacheForRequest } from '../../helpers/auth-token-cache.helper';
import { ContractPortfolioRepository } from '../../database/repositories/contract-portfolio.repository';
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
const contractPortfolioRepo = new ContractPortfolioRepository();

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

      // Promoção automática: ao concluir a identidade pela primeira vez num tenant provisório,
      // o utilizador criador deixa de ser "viewer" e vira admin com permissões completas.
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
        await LoginModel.update(
          { role: 'admin', permissions: { ...FULL_PERMISSIONS } },
          { where: { id: req.user.id, tenant_id: tenantId } },
        );
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

  async setContractCode(req: AuthRequest & TenantRequest, res: Response) {
    try {
      const tenantId = requireTenantId(req, res);
      if (tenantId === null) return;
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

      const tenant = await TenantModel.findByPk(tenantId);
      if (!tenant)
        return res.status(404).json({ error: 'Tenant não encontrado' });
      if (String(tenant.slug ?? '') === 'viewer') {
        return res.status(400).json({ error: 'Tenant inválido para contrato' });
      }

      const resolved =
        await contractPortfolioRepo.resolveOrCreateByPlainText(code);

      const provisionalSlug = String(tenant.slug ?? '');
      const isProvisional = provisionalSlug.startsWith('u-');

      const canonical = await TenantModel.findOne({
        where: {
          contract_portfolio_id: resolved.id,
          id: { [Op.ne]: tenantId },
          slug: {
            [Op.and]: [{ [Op.ne]: 'viewer' }, { [Op.notLike]: 'u-%' }],
          },
        },
        order: [['id', 'ASC']],
      });

      if (canonical && isProvisional && req.user?.id != null) {
        try {
          await sequelize.transaction(async t => {
            const conflict = await LoginModel.findOne({
              where: {
                tenant_id: canonical.id,
                login: String(req.user!.login).trim(),
              },
              transaction: t,
            });
            if (conflict && conflict.id !== req.user!.id) {
              throw new HttpError(
                'Já existe utilizador com este e-mail neste abrigo. Use outro e-mail ou peça ao administrador.',
                409,
              );
            }

            const canonRow = await TenantModel.findByPk(canonical.id, {
              transaction: t,
            });
            const provRow = await TenantModel.findByPk(tenantId, {
              transaction: t,
            });
            if (!canonRow || !provRow) {
              throw new HttpError('Tenant não encontrado', 404);
            }

            if (!hasIdentity(canonRow) && hasIdentity(provRow)) {
              await TenantModel.update(
                {
                  brand_name: provRow.brand_name ?? null,
                  logo_url: provRow.logo_url ?? null,
                },
                { where: { id: canonical.id }, transaction: t },
              );
            }

            await LoginModel.update(
              {
                tenant_id: canonical.id,
                role: 'admin',
                permissions: { ...FULL_PERMISSIONS },
              },
              { where: { id: req.user!.id }, transaction: t },
            );

            await TenantInviteModel.destroy({
              where: { tenant_id: tenantId },
              transaction: t,
            });
            await sequelize.query(
              `DELETE FROM login_log
               WHERE user_id IN (SELECT id FROM login WHERE tenant_id = :tid)`,
              { replacements: { tid: tenantId }, transaction: t },
            );
            await TenantConfigModel.destroy({
              where: { tenant_id: tenantId },
              transaction: t,
            });
            const deleted = await TenantModel.destroy({
              where: { id: tenantId },
              transaction: t,
            });
            if (!deleted) {
              throw new HttpError(
                'Não foi possível remover o abrigo temporário',
                500,
              );
            }
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
        const afterCanon = await TenantModel.findByPk(canonical.id);
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
}
