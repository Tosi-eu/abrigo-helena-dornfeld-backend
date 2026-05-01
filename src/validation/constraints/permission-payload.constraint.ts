import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  type ValidationArguments,
} from 'class-validator';
import { ALL_PERMISSION_RESOURCE_KEYS } from '@helpers/permission-matrix.resolver';

const MOVEMENT_TIPOS = ['entrada', 'saida', 'transferencia'] as const;

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === 'object' && !Array.isArray(x);
}

function isBoolOrUndef(x: unknown): boolean {
  return x === undefined || typeof x === 'boolean';
}

function hasOnlyKeys(
  obj: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(obj).every(k => allowed.includes(k));
}

@ValidatorConstraint({ name: 'permissionPayload', async: false })
export class PermissionPayloadConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, _args: ValidationArguments): boolean {
    if (value === undefined || value === null) return true;
    if (!isPlainObject(value)) return false;

    // V2: { version: 2, resources: {...}, movement_tipos: {...} }
    if (value.version === 2) {
      const resources = value.resources;
      const movement_tipos = value.movement_tipos;
      if (!isPlainObject(resources)) return false;
      if (!isPlainObject(movement_tipos)) return false; // exigimos para consistência do contrato

      if (!hasOnlyKeys(resources, ALL_PERMISSION_RESOURCE_KEYS)) return false;
      if (!hasOnlyKeys(movement_tipos, MOVEMENT_TIPOS)) return false;

      for (const rk of Object.keys(resources)) {
        const patch = (resources as Record<string, unknown>)[rk];
        if (!isPlainObject(patch)) return false;
        if (!hasOnlyKeys(patch, ['read', 'create', 'update', 'delete']))
          return false;
        if (
          !isBoolOrUndef(patch.read) ||
          !isBoolOrUndef(patch.create) ||
          !isBoolOrUndef(patch.update) ||
          !isBoolOrUndef(patch.delete)
        )
          return false;
      }

      for (const mk of Object.keys(movement_tipos)) {
        const v = (movement_tipos as Record<string, unknown>)[mk];
        if (typeof v !== 'boolean') return false;
      }

      return true;
    }

    // Legacy flat: { read, create, update, delete }
    if (!hasOnlyKeys(value, ['read', 'create', 'update', 'delete']))
      return false;
    return (
      isBoolOrUndef(value.read) &&
      isBoolOrUndef(value.create) &&
      isBoolOrUndef(value.update) &&
      isBoolOrUndef(value.delete)
    );
  }

  defaultMessage(): string {
    return (
      'permissions deve ser {read,create,update,delete} (legado) ' +
      'ou {version:2, resources:{...}, movement_tipos:{entrada,saida,transferencia}}'
    );
  }
}
