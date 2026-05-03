import type {
  MovementTipoKey,
  PermissionResourceKey,
  ResourceCrud,
  RoutePermissionDecision,
} from '@domain/permission-matrix.types';

const API_PREFIX = /^\/api\/v1/i;

function normalizePath(originalUrl: string): string {
  let p = originalUrl.split('?')[0] ?? '';
  p = p.replace(API_PREFIX, '') || '/';
  if (!p.startsWith('/')) p = `/${p}`;
  return p;
}

function mapMethodToCrud(method: string): keyof ResourceCrud {
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'HEAD') return 'read';
  if (m === 'POST') return 'create';
  if (m === 'PUT' || m === 'PATCH') return 'update';
  if (m === 'DELETE') return 'delete';
  return 'read';
}

const SEGMENT_TO_RESOURCE: Record<string, PermissionResourceKey> = {
  dashboard: 'dashboard',
  residentes: 'residents',
  medicamentos: 'medicines',
  insumos: 'inputs',
  estoque: 'stock',
  relatorios: 'reports',
  notificacao: 'notifications',
  notificacoes: 'notifications',
  armarios: 'cabinets',
  gavetas: 'drawers',
  'categoria-armario': 'cabinet_categories',
  'categoria-gaveta': 'drawer_categories',
  login: 'profile',
  admin: 'admin',
};

function isMovementTipo(x: string): x is MovementTipoKey {
  return x === 'entrada' || x === 'saida' || x === 'transferencia';
}

export function resolveRoutePermission(
  method: string,
  originalUrl: string,
  body: unknown,
): RoutePermissionDecision {
  const path = normalizePath(originalUrl);
  const seg = path.split('/').filter(Boolean);
  const m = method.toUpperCase();

  if (seg.length === 0) {
    return { kind: 'deny_unknown' };
  }

  const first = seg[0]!;

  if (first === 'movimentacoes') {
    if (m === 'GET' || m === 'HEAD') {
      return { kind: 'crud', resource: 'movements', action: 'read' };
    }
    if (m === 'POST') {
      const rawTipo =
        body &&
        typeof body === 'object' &&
        'tipo' in body &&
        typeof (body as { tipo?: unknown }).tipo === 'string'
          ? String((body as { tipo: string }).tipo)
              .trim()
              .toLowerCase()
          : '';
      if (isMovementTipo(rawTipo)) {
        return { kind: 'movement_tipo', tipo: rawTipo };
      }
      return { kind: 'crud', resource: 'movements', action: 'create' };
    }
    return {
      kind: 'crud',
      resource: 'movements',
      action: mapMethodToCrud(m),
    };
  }

  if (first === 'estoque' && m === 'POST') {
    const op = seg[1]?.trim().toLowerCase() ?? '';
    if (isMovementTipo(op)) {
      return { kind: 'movement_tipo', tipo: op };
    }
  }

  if (first === 'tenant') {
    if (seg[1] === 'import') {
      if (seg[2] === 'template') {
        return {
          kind: 'crud',
          resource: 'imports',
          action: m === 'GET' || m === 'HEAD' ? 'read' : 'create',
        };
      }
      if (seg[2] === 'xlsx') {
        return { kind: 'crud', resource: 'imports', action: 'create' };
      }
    }
    return { kind: 'crud', resource: 'tenant', action: mapMethodToCrud(m) };
  }

  const resource = SEGMENT_TO_RESOURCE[first];
  if (!resource) {
    return { kind: 'deny_unknown' };
  }

  return {
    kind: 'crud',
    resource,
    action: mapMethodToCrud(m),
  };
}
