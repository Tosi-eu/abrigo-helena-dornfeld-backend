import { z } from 'zod';
import type { TenantModulesConfig, ModuleKey } from '@domain/tenant.types';
import type { PrismaTenantConfigRepository } from '@repositories/tenant-config.repository';

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
  'cabinets',
  'drawers',
  'profile',
]);

const tenantModulesStoredSchema = z.object({
  enabled: z.array(moduleKeySchema).default([]),
  automatic_price_search: z.boolean().optional(),
  automatic_reposicao_notifications: z.boolean().optional(),
});

export const tenantModulesConfigSchema = z.object({
  enabled: z.array(moduleKeySchema).min(1),
  automatic_price_search: z.boolean(),
  automatic_reposicao_notifications: z.boolean(),
});

export const DEFAULT_TENANT_MODULES: TenantModulesConfig = {
  enabled: [
    'dashboard',
    'admin',
    'residents',
    'medicines',
    'inputs',
    'stock',
    'movements',
    'reports',
    'notifications',
    'cabinets',
    'drawers',
    'profile',
  ],
  automatic_price_search: true,
  automatic_reposicao_notifications: true,
};

export class TenantConfigService {
  constructor(private readonly repo: PrismaTenantConfigRepository) {}

  async get(tenantId: number): Promise<TenantModulesConfig> {
    const row = await this.repo.getByTenantId(tenantId);
    if (!row?.modules_json) return { ...DEFAULT_TENANT_MODULES };
    const parsed = tenantModulesStoredSchema.safeParse(row.modules_json);
    if (!parsed.success) return { ...DEFAULT_TENANT_MODULES };
    const d = parsed.data;
    return {
      enabled: d.enabled.length ? d.enabled : DEFAULT_TENANT_MODULES.enabled,
      automatic_price_search: d.automatic_price_search ?? true,
      automatic_reposicao_notifications:
        d.automatic_reposicao_notifications ?? true,
    };
  }

  async set(
    tenantId: number,
    modulesJson: unknown,
  ): Promise<TenantModulesConfig> {
    const prev = await this.get(tenantId);
    const body =
      modulesJson && typeof modulesJson === 'object'
        ? (modulesJson as Record<string, unknown>)
        : {};

    const merged: TenantModulesConfig = {
      enabled: Array.isArray(body.enabled)
        ? (body.enabled as ModuleKey[])
        : prev.enabled,
      automatic_price_search:
        typeof body.automatic_price_search === 'boolean'
          ? body.automatic_price_search
          : prev.automatic_price_search,
      automatic_reposicao_notifications:
        typeof body.automatic_reposicao_notifications === 'boolean'
          ? body.automatic_reposicao_notifications
          : prev.automatic_reposicao_notifications,
    };

    const parsed = tenantModulesConfigSchema.safeParse(merged);
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

  async listAllTenantIds(): Promise<number[]> {
    return this.repo.listAllTenantIds();
  }
}
