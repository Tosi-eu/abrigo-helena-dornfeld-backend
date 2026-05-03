import bcrypt from 'bcrypt';
import { getDb } from '@repositories/prisma';
import { PrismaTenantConfigRepository } from '@repositories/tenant-config.repository';
import { PrismaLoginRepository } from '@repositories/login.repository';
import { DEFAULT_TENANT_MODULES } from '@services/tenant-config.service';
import { PrismaSetorRepository } from '@repositories/setor.repository';

export const E2E_TENANT_SLUG = 'e2e';

export const E2E_SEED_USER = {
  login: 'e2e_user',
  password: 'senha1234',
} as const;

export const E2E_RESOLVER_SEED_USER = {
  login: 'resolver@example.com',
  password: 'senha1234',
} as const;

const tenantConfigRepo = new PrismaTenantConfigRepository();
const setorRepo = new PrismaSetorRepository();
const loginRepo = new PrismaLoginRepository();

const ADMIN_PERMISSIONS = {
  read: true,
  create: true,
  update: true,
  delete: true,
} as const;

const USER_PERMISSIONS = {
  read: true,
  create: false,
  update: false,
  delete: false,
} as const;

const seedLogins: readonly {
  login: string;
  password: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'user';
}[] = [
  {
    login: E2E_SEED_USER.login,
    password: E2E_SEED_USER.password,
    first_name: 'E2E',
    last_name: 'User',
    role: 'admin',
  },
  {
    login: E2E_RESOLVER_SEED_USER.login,
    password: E2E_RESOLVER_SEED_USER.password,
    first_name: 'Resolver',
    last_name: 'E2E',
    role: 'user',
  },
];

export async function seedE2EDefaultTenant(): Promise<void> {
  await getDb().tenant.upsert({
    where: { slug: E2E_TENANT_SLUG },
    create: {
      slug: E2E_TENANT_SLUG,
      name: 'Abrigo E2E',
      brand_name: 'Marca E2E',
    },
    update: { name: 'Abrigo E2E', brand_name: 'Marca E2E' },
  });
  const tenant = await getDb().tenant.findUnique({
    where: { slug: E2E_TENANT_SLUG },
  });
  if (!tenant) throw new Error('E2E tenant seed failed');
  await setorRepo.ensureDefaultSetores(tenant.id);
  await tenantConfigRepo.setByTenantId(tenant.id, DEFAULT_TENANT_MODULES);

  for (const u of seedLogins) {
    const existing = await loginRepo.findByLoginForTenant(u.login, tenant.id);
    if (existing) {
      // Reparar BD onde outro login foi criado primeiro e e2e_user ficou como user.
      if (existing.role !== u.role) {
        await getDb().login.update({
          where: { id: existing.id },
          data: {
            role: u.role,
            permissions:
              u.role === 'admin' ? ADMIN_PERMISSIONS : USER_PERMISSIONS,
          },
        });
      }
      continue;
    }
    const hashed = await bcrypt.hash(u.password, 10);
    await loginRepo.create({
      login: u.login,
      password: hashed,
      first_name: u.first_name,
      last_name: u.last_name,
      tenant_id: tenant.id,
      role: u.role,
    });
  }
}
