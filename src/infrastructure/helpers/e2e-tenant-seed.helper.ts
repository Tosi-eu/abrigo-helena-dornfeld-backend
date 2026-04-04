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

export const E2E_RESOLVER_SEED_USER = {
  login: 'resolver@example.com',
  password: 'senha1234',
} as const;

const tenantConfigRepo = new TenantConfigRepository();
const loginRepo = new LoginRepository();

const seedLogins: readonly {
  login: string;
  password: string;
  first_name: string;
  last_name: string;
}[] = [
  {
    login: E2E_SEED_USER.login,
    password: E2E_SEED_USER.password,
    first_name: 'E2E',
    last_name: 'User',
  },
  {
    login: E2E_RESOLVER_SEED_USER.login,
    password: E2E_RESOLVER_SEED_USER.password,
    first_name: 'Resolver',
    last_name: 'E2E',
  },
];

export async function seedE2EDefaultTenant(): Promise<void> {
  const [tenant] = await TenantModel.findOrCreate({
    where: { slug: E2E_TENANT_SLUG },
    defaults: {
      slug: E2E_TENANT_SLUG,
      name: 'Abrigo E2E',
    },
  });
  await tenantConfigRepo.setByTenantId(tenant.id, DEFAULT_TENANT_MODULES);

  for (const u of seedLogins) {
    const existing = await loginRepo.findByLoginForTenant(u.login, tenant.id);
    if (existing) continue;
    const hashed = await bcrypt.hash(u.password, 10);
    await loginRepo.create({
      login: u.login,
      password: hashed,
      first_name: u.first_name,
      last_name: u.last_name,
      tenant_id: tenant.id,
    });
  }
}
