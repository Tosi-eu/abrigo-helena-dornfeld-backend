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
  'cabinets',
  'drawers',
  'profile',
]);

export const tenantModulesConfigSchema = z.object({
  enabled: z.array(moduleKeySchema).default([]),
});

/** Módulos habilitados por padrão ao criar abrigo ou ao corrigir linha ausente em `tenant_config`. */
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
};

/** Chaves adicionadas depois; em configs antigas passam a entrar como habilitadas por omissão. */
const OPTIONAL_DEFAULT_ON: ModuleKey[] = ['cabinets', 'drawers', 'profile'];

export class TenantConfigService {
  constructor(private readonly repo: TenantConfigRepository) {}

  async get(tenantId: number): Promise<TenantModulesConfig> {
    const row = await this.repo.getByTenantId(tenantId);
    if (!row?.modules_json) return { enabled: [] };
    const parsed = tenantModulesConfigSchema.safeParse(row.modules_json);
    if (!parsed.success) return { enabled: [] };
    const enabled = parsed.data.enabled;
    if (enabled.length === 0) return parsed.data;
    const set = new Set(enabled);
    let changed = false;
    for (const k of OPTIONAL_DEFAULT_ON) {
      if (!set.has(k)) {
        set.add(k);
        changed = true;
      }
    }
    return changed
      ? { enabled: Array.from(set) as ModuleKey[] }
      : parsed.data;
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
