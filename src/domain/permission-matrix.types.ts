import type { UserPermissions } from './user.types';

export type PermissionResourceKey =
  | 'dashboard'
  | 'residents'
  | 'medicines'
  | 'inputs'
  | 'stock'
  | 'movements'
  | 'reports'
  | 'notifications'
  | 'admin'
  | 'cabinets'
  | 'drawers'
  | 'cabinet_categories'
  | 'drawer_categories'
  | 'tenant'
  | 'imports'
  | 'profile';

export type MovementTipoKey = 'entrada' | 'saida' | 'transferencia';

export type ResourceCrud = UserPermissions;

export type PermissionMatrixV2Stored = {
  version: 2;
  resources: Partial<Record<PermissionResourceKey, Partial<ResourceCrud>>>;

  movement_tipos?: Partial<Record<MovementTipoKey, boolean>>;
};

export type EffectivePermissionMatrix = {
  resources: Record<PermissionResourceKey, ResourceCrud>;
  movement_tipos: Record<MovementTipoKey, boolean>;
};

export type RoutePermissionDecision =
  | {
      kind: 'crud';
      resource: PermissionResourceKey;
      action: keyof ResourceCrud;
    }
  | {
      kind: 'movement_tipo';
      tipo: MovementTipoKey;
    }
  | { kind: 'deny_unknown' };
