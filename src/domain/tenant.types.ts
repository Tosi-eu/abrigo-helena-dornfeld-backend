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

/**
 * Chaves de setor no catálogo (`setor.key`) por tenant — ex.: farmacia, enfermagem, psicologia.
 */
export type TenantSectorKey = string;

export const DEFAULT_ENABLED_SECTORS: TenantSectorKey[] = [
  'farmacia',
  'enfermagem',
];

export type TenantModulesConfig = {
  enabled: ModuleKey[];
  automatic_price_search: boolean;
  automatic_reposicao_notifications: boolean;
  /** Pelo menos uma chave existente em `setor` para o tenant; padrão farmácia + enfermagem. */
  enabled_sectors: TenantSectorKey[];
};
