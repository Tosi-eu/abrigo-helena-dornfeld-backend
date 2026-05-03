export type ModuleKey =
  | 'residents'
  | 'medicines'
  | 'inputs'
  | 'stock'
  | 'movements'
  | 'reports'
  | 'notifications'
  | 'dashboard'
  | 'admin'
  | 'cabinets'
  | 'drawers'
  | 'profile';

export type TenantSectorKey = string;

export const DEFAULT_ENABLED_SECTORS: TenantSectorKey[] = [
  'farmacia',
  'enfermagem',
];

export type TenantModulesConfig = {
  enabled: ModuleKey[];
  automatic_price_search: boolean;
  automatic_reposicao_notifications: boolean;

  enabled_sectors: TenantSectorKey[];
};
