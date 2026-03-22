import TenantModel from '../database/models/tenant.model';
import { TenantConfigRepository } from '../database/repositories/tenant-config.repository';
import { DEFAULT_TENANT_MODULES } from '../../core/services/tenant-config.service';

/** Slug do tenant criado em `NODE_ENV=test` após `sync({ force })` — usar com header `X-Tenant` em login/cadastro. */
export const E2E_TENANT_SLUG = 'e2e';

const tenantConfigRepo = new TenantConfigRepository();

/**
 * Garante um tenant padrão para e2e + `tenant_config` com todos os módulos (senão `requireModule` retorna 403).
 * O primeiro utilizador cadastrado nesse tenant vira admin (regra do repositório).
 */
export async function seedE2EDefaultTenant(): Promise<void> {
  const [tenant] = await TenantModel.findOrCreate({
    where: { slug: E2E_TENANT_SLUG },
    defaults: {
      slug: E2E_TENANT_SLUG,
      name: 'Abrigo E2E',
    },
  });
  await tenantConfigRepo.setByTenantId(tenant.id, DEFAULT_TENANT_MODULES);
}
