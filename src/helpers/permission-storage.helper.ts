import type { Prisma } from '@prisma/client';
import type { PermissionMatrixV2Stored } from '@domain/permission-matrix.types';

function isV2(x: Record<string, unknown>): x is PermissionMatrixV2Stored {
  return (
    x.version === 2 && x.resources != null && typeof x.resources === 'object'
  );
}

/**
 * Normaliza o corpo de `permissions` (legado 4 flags ou `version:2` + `resources`) para JSON no `login.permissions`.
 */
export function parsePermissionsForStorage(
  role: 'admin' | 'user',
  raw: unknown,
): Prisma.InputJsonValue {
  if (role === 'admin') {
    return {
      read: true,
      create: true,
      update: true,
      delete: true,
    } as Prisma.InputJsonValue;
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (isV2(o)) {
      return o as unknown as Prisma.InputJsonValue;
    }
    return {
      read: o.read !== false,
      create: Boolean(o.create),
      update: Boolean(o.update),
      delete: Boolean(o.delete),
    } as Prisma.InputJsonValue;
  }
  return {
    read: true,
    create: false,
    update: false,
    delete: false,
  } as Prisma.InputJsonValue;
}
