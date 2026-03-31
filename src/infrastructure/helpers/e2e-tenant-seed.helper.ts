import bcrypt from 'bcrypt';
import TenantModel from '../database/models/tenant.model';
import { TenantConfigRepository } from '../database/repositories/tenant-config.repository';
import { LoginRepository } from '../database/repositories/login.repository';
import { DEFAULT_TENANT_MODULES } from '../../core/services/tenant-config.service';

export const E2E_TENANT_SLUG = 'e2e';

export const E2E_SEED_USER = {
  login: 'e2e_user',
  password: 'senha1234',
} as const;

const tenantConfigRepo = new TenantConfigRepository();
const loginRepo = new LoginRepository();

export async function seedE2EDefaultTenant(): Promise<void> {
  const [tenant] = await TenantModel.findOrCreate({
    where: { slug: E2E_TENANT_SLUG },
    defaults: {
      slug: E2E_TENANT_SLUG,
      name: 'Abrigo E2E',
    },
  });
  await tenantConfigRepo.setByTenantId(tenant.id, DEFAULT_TENANT_MODULES);

  const existing = await loginRepo.findByLoginForTenant(
    E2E_SEED_USER.login,
    tenant.id,
  );
  if (existing) return;

  const hashed = await bcrypt.hash(E2E_SEED_USER.password, 10);
  await loginRepo.create({
    login: E2E_SEED_USER.login,
    password: hashed,
    first_name: 'E2E',
    last_name: 'User',
    tenant_id: tenant.id,
  });
}
