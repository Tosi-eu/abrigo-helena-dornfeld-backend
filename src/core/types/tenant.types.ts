export type ModuleKey =
  | 'residents'
  | 'medicines'
  | 'inputs'
  | 'stock'
  | 'movements'
  | 'reports'
  | 'notifications'
  | 'dashboard'
  | 'admin';

export type TenantModulesConfig = {
  enabled: ModuleKey[];
};
