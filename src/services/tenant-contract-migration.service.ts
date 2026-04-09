import type { Prisma } from '@prisma/client';
import { HttpError } from '@domain/error.types';
import { withRootTransaction } from '@repositories/prisma';

const FULL_PERMISSIONS = {
  read: true,
  create: true,
  update: true,
  delete: true,
} as const;

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

/**
 * Move o login atual do tenant provisório (`u-*`) para o tenant canónico,
 * copia branding se fizer sentido, e remove o tenant provisório.
 */
export async function migrateProvisionalLoginToCanonicalTenant(params: {
  sessionUser: { id: number; login: string };
  provisionalTenantId: number;
  canonicalTenantId: number;
}): Promise<void> {
  const { sessionUser, provisionalTenantId, canonicalTenantId } = params;

  await withRootTransaction(async t => {
    const conflict = await t.login.findFirst({
      where: {
        tenant_id: canonicalTenantId,
        login: String(sessionUser.login).trim(),
      },
    });
    if (conflict && conflict.id !== sessionUser.id) {
      throw new HttpError(
        'Já existe utilizador com este e-mail neste abrigo. Use outro e-mail ou peça ao administrador.',
        409,
      );
    }

    const canonRow = await t.tenant.findUnique({
      where: { id: canonicalTenantId },
      select: { id: true, brand_name: true, logo_url: true },
    });
    const provRow = await t.tenant.findUnique({
      where: { id: provisionalTenantId },
      select: { id: true, brand_name: true, logo_url: true },
    });
    if (!canonRow || !provRow) {
      throw new HttpError('Tenant não encontrado', 404);
    }

    if (!hasIdentity(canonRow) && hasIdentity(provRow)) {
      await t.tenant.update({
        where: { id: canonicalTenantId },
        data: {
          brand_name: provRow.brand_name ?? null,
          logo_url: provRow.logo_url ?? null,
        },
      });
    }

    const canonOwner = await t.login.findFirst({
      where: {
        tenant_id: canonicalTenantId,
        is_tenant_owner: true,
      },
      select: { id: true },
    });

    await t.login.update({
      where: { id: sessionUser.id },
      data: {
        tenant_id: canonicalTenantId,
        role: 'admin',
        permissions: { ...FULL_PERMISSIONS } as Prisma.InputJsonValue,
        // Se ainda não existe owner no abrigo definitivo, este primeiro utilizador vira owner.
        is_tenant_owner: canonOwner ? false : true,
      },
    });

    await t.tenantInvite.deleteMany({
      where: { tenant_id: provisionalTenantId },
    });
    await t.$executeRaw`
      DELETE FROM login_log
      WHERE user_id IN (SELECT id FROM login WHERE tenant_id = ${provisionalTenantId})
    `;
    await t.tenantConfig.deleteMany({
      where: { tenant_id: provisionalTenantId },
    });
    try {
      await t.tenant.delete({ where: { id: provisionalTenantId } });
    } catch {
      throw new HttpError('Não foi possível remover o abrigo temporário', 500);
    }
  });
}
