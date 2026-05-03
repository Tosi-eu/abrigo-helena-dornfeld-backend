import { z } from 'zod';
import type { TenantModulesConfig, ModuleKey } from '@domain/tenant.types';
import { DEFAULT_ENABLED_SECTORS } from '@domain/tenant.types';
import type { PrismaTenantConfigRepository } from '@repositories/tenant-config.repository';
import { PrismaSetorRepository } from '@repositories/setor.repository';

const tenantSectorKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{1,64}$/, {
    message:
      'Chave de setor: use apenas letras minúsculas, números e sublinhado (1–64 caracteres)',
  });

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
  enabled_sectors: z.array(z.string()).optional(),
});

export const tenantModulesConfigSchema = z.object({
  enabled: z.array(moduleKeySchema).min(1),
  automatic_price_search: z.boolean(),
  automatic_reposicao_notifications: z.boolean(),
  enabled_sectors: z.array(tenantSectorKeySchema).min(1),
});

function normalizeEnabledSectors(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_ENABLED_SECTORS];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== 'string') continue;
    const k = x.trim().toLowerCase();
    if (!/^[a-z0-9_]{1,64}$/.test(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out.length ? out : [...DEFAULT_ENABLED_SECTORS];
}

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
  enabled_sectors: [...DEFAULT_ENABLED_SECTORS],
};

export class TenantConfigService {
  constructor(
    private readonly repo: PrismaTenantConfigRepository,
    private readonly setorRepo: PrismaSetorRepository,
  ) {}

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
      enabled_sectors: normalizeEnabledSectors(d.enabled_sectors),
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
      enabled_sectors: Array.isArray(body.enabled_sectors)
        ? normalizeEnabledSectors(body.enabled_sectors)
        : prev.enabled_sectors,
    };

    const parsed = tenantModulesConfigSchema.safeParse(merged);
    if (!parsed.success) {
      const msg = parsed.error.issues.map(i => i.message).join('; ');
      throw new Error(msg || 'Config inválida');
    }
    await this.setorRepo.ensureDefaultSetores(tenantId);
    const sectorsOk = await this.setorRepo.keysExistForTenant(
      tenantId,
      parsed.data.enabled_sectors,
    );
    if (!sectorsOk) {
      throw new Error(
        'Um ou mais setores em enabled_sectors não existem no catálogo do abrigo. Crie o setor antes de habilitá-lo.',
      );
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
