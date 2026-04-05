import type { Prisma } from '@prisma/client';
import { getDb } from '@repositories/prisma';

export class PrismaTenantConfigRepository {
  async getByTenantId(tenantId: number) {
    return getDb().tenantConfig.findFirst({
      where: { tenant_id: tenantId },
      select: { tenant_id: true, modules_json: true },
    });
  }

  async listAllTenantIds(): Promise<number[]> {
    const rows = await getDb().tenant.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    return rows.map(r => r.id);
  }

  async setByTenantId(tenantId: number, modulesJson: object) {
    const data = { modules_json: modulesJson as Prisma.InputJsonValue };
    await getDb().tenantConfig.upsert({
      where: { tenant_id: tenantId },
      create: { tenant_id: tenantId, ...data },
      update: data,
    });
    return this.getByTenantId(tenantId);
  }
}
