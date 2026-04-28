import type { Prisma } from '@prisma/client';
import type { UserPermissions } from '@domain/user.types';
import type {
  EffectivePermissionMatrix,
  MovementTipoKey,
  PermissionMatrixV2Stored,
  PermissionResourceKey,
  ResourceCrud,
} from '@domain/permission-matrix.types';

export const ALL_PERMISSION_RESOURCE_KEYS: PermissionResourceKey[] = [
  'dashboard',
  'residents',
  'medicines',
  'inputs',
  'stock',
  'movements',
  'reports',
  'notifications',
  'admin',
  'cabinets',
  'drawers',
  'cabinet_categories',
  'drawer_categories',
  'tenant',
  'imports',
  'profile',
];

const MOVEMENT_TIPOS: MovementTipoKey[] = ['entrada', 'saida', 'transferencia'];

const DEFAULT_CRUD: ResourceCrud = {
  read: true,
  create: false,
  update: false,
  delete: false,
};

const FULL_CRUD: ResourceCrud = {
  read: true,
  create: true,
  update: true,
  delete: true,
};

function cloneCrud(
  base: ResourceCrud,
  patch?: Partial<ResourceCrud>,
): ResourceCrud {
  return {
    read: patch?.read ?? base.read,
    create: patch?.create ?? base.create,
    update: patch?.update ?? base.update,
    delete: patch?.delete ?? base.delete,
  };
}

function fullMatrix(): EffectivePermissionMatrix {
  const resources = {} as Record<PermissionResourceKey, ResourceCrud>;
  for (const k of ALL_PERMISSION_RESOURCE_KEYS) {
    resources[k] = { ...FULL_CRUD };
  }
  const movement_tipos = {
    entrada: true,
    saida: true,
    transferencia: true,
  } as Record<MovementTipoKey, boolean>;
  return { resources, movement_tipos };
}

function expandLegacyFlatToMatrix(
  flat: ResourceCrud,
): EffectivePermissionMatrix {
  const resources = {} as Record<PermissionResourceKey, ResourceCrud>;
  for (const k of ALL_PERMISSION_RESOURCE_KEYS) {
    resources[k] = { ...flat };
  }
  const baseMove = flat.create;
  const movement_tipos = {
    entrada: baseMove,
    saida: baseMove,
    transferencia: baseMove,
  };
  return { resources, movement_tipos };
}

function isV2Stored(x: Record<string, unknown>): x is PermissionMatrixV2Stored {
  return (
    x.version === 2 &&
    x.resources != null &&
    typeof x.resources === 'object' &&
    !Array.isArray(x.resources)
  );
}

function mergeV2(stored: PermissionMatrixV2Stored): EffectivePermissionMatrix {
  const base = expandLegacyFlatToMatrix(DEFAULT_CRUD);
  for (const k of ALL_PERMISSION_RESOURCE_KEYS) {
    const patch = stored.resources[k];
    if (patch) {
      base.resources[k] = cloneCrud(base.resources[k], patch);
    }
  }
  const movCreate = base.resources.movements.create;
  for (const t of MOVEMENT_TIPOS) {
    const explicit = stored.movement_tipos?.[t];
    base.movement_tipos[t] =
      explicit !== undefined ? Boolean(explicit) : movCreate;
  }
  return base;
}

export function buildEffectivePermissionMatrix(
  role: 'admin' | 'user',
  stored: Prisma.JsonValue | null | undefined,
): EffectivePermissionMatrix {
  if (role === 'admin') {
    return fullMatrix();
  }

  const obj =
    stored && typeof stored === 'object' && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : null;

  if (obj && isV2Stored(obj)) {
    return mergeV2(obj);
  }

  const flat: ResourceCrud = {
    read: obj?.read !== false,
    create: Boolean(obj?.create),
    update: Boolean(obj?.update),
    delete: Boolean(obj?.delete),
  };
  return expandLegacyFlatToMatrix(flat);
}

/** Resumo plano (compatível com UI/API antiga): OR lógico sobre todos os recursos. */
export function summarizeFlatFromMatrix(
  matrix: EffectivePermissionMatrix,
): UserPermissions {
  let read = false;
  let create = false;
  let update = false;
  let delete_ = false;
  for (const k of ALL_PERMISSION_RESOURCE_KEYS) {
    const r = matrix.resources[k];
    if (r.read) read = true;
    if (r.create) create = true;
    if (r.update) update = true;
    if (r.delete) delete_ = true;
  }
  return { read, create, update, delete: delete_ };
}

export function canCrud(
  matrix: EffectivePermissionMatrix,
  resource: PermissionResourceKey,
  action: keyof ResourceCrud,
): boolean {
  return Boolean(matrix.resources[resource]?.[action]);
}

export function canMovementTipo(
  matrix: EffectivePermissionMatrix,
  tipo: MovementTipoKey,
): boolean {
  if (!matrix.resources.movements.create) return false;
  return Boolean(matrix.movement_tipos[tipo]);
}

/** Para RLS / contexto grosseiro: algum recurso permite criar? */
export function matrixHasAnyCreate(matrix: EffectivePermissionMatrix): boolean {
  return ALL_PERMISSION_RESOURCE_KEYS.some(k => matrix.resources[k]?.create);
}

export function matrixHasAnyUpdate(matrix: EffectivePermissionMatrix): boolean {
  return ALL_PERMISSION_RESOURCE_KEYS.some(k => matrix.resources[k]?.update);
}

export function matrixHasAnyDelete(matrix: EffectivePermissionMatrix): boolean {
  return ALL_PERMISSION_RESOURCE_KEYS.some(k => matrix.resources[k]?.delete);
}
