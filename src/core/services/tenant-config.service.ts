import { z } from 'zod';
import type { TenantModulesConfig, ModuleKey } from '../types/tenant.types';
import { TenantConfigRepository } from '../../infrastructure/database/repositories/tenant-config.repository';

const moduleKeySchema = z.enum([
  'residents',
  'medicines',
  'inputs',
  'stock',
  'movements',
  'reports',
  'notifications',
  'dashboard',
  'admin',
]);

export const tenantModulesConfigSchema = z.object({
  enabled: z.array(moduleKeySchema).default([]),
});

export class TenantConfigService {
  constructor(private readonly repo: TenantConfigRepository) {}

  async get(tenantId: number): Promise<TenantModulesConfig> {
    const row = await this.repo.getByTenantId(tenantId);
    if (!row?.modules_json) return { enabled: [] };
    const parsed = tenantModulesConfigSchema.safeParse(row.modules_json);
    return parsed.success ? parsed.data : { enabled: [] };
  }

  async set(
    tenantId: number,
    modulesJson: unknown,
  ): Promise<TenantModulesConfig> {
    const parsed = tenantModulesConfigSchema.safeParse(modulesJson);
    if (!parsed.success) {
      const msg = parsed.error.issues.map(i => i.message).join('; ');
      throw new Error(msg || 'Config inválida');
    }
    await this.repo.setByTenantId(tenantId, parsed.data as object);
    return parsed.data;
  }

  isEnabled(config: TenantModulesConfig, key: ModuleKey): boolean {
    return Array.isArray(config.enabled) && config.enabled.includes(key);
  }
}
