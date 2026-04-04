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

export type TenantModulesConfig = {
  enabled: ModuleKey[];
  automatic_price_search: boolean;
  automatic_reposicao_notifications: boolean;
};
