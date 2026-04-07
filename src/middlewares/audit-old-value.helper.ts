import type { AuthRequest } from './auth.middleware';
import { getDb } from '@repositories/prisma';

export async function getOldValueForAudit(
  path: string,
  method: string,
  req?: AuthRequest,
): Promise<Record<string, unknown> | null> {
  if (!['PUT', 'PATCH', 'DELETE'].includes(method)) return null;

  const segments = path
    .replace(/^\/api\/v1/, '')
    .split('/')
    .filter(Boolean);
  const resource = segments[0] ?? null;

  if (resource === 'login' && method === 'PUT' && req?.user?.id) {
    try {
      const row = await getDb().login.findUnique({
        where: { id: req.user.id },
      });
      if (!row) return null;
      const { password: _p, refreshToken: _r, ...rest } = row;
      return rest as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  if (resource === 'admin' && segments[1] === 'users' && segments[2]) {
    const id = Number(segments[2]);
    if (!Number.isNaN(id)) {
      try {
        const row = await getDb().login.findUnique({ where: { id } });
        if (!row) return null;
        const { password: _p, refreshToken: _r, ...rest } = row;
        return rest as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }

  if (segments.length < 2) return null;
  const idParam =
    resource === 'estoque' &&
    (segments[1] === 'medicamento' || segments[1] === 'insumo') &&
    segments.length >= 3
      ? segments[2]
      : segments[1];
  const id = Number(idParam);
  if (Number.isNaN(id)) return null;

  try {
    switch (resource) {
      case 'medicamentos': {
        const row = await getDb().medicamento.findUnique({ where: { id } });
        return row ? ({ ...row } as Record<string, unknown>) : null;
      }
      case 'insumos': {
        const row = await getDb().insumo.findUnique({ where: { id } });
        return row ? ({ ...row } as Record<string, unknown>) : null;
      }
      case 'residentes': {
        const row = await getDb().residente.findUnique({
          where: { id: BigInt(id) },
        });
        return row
          ? ({
              ...row,
              id: row.id.toString(),
            } as Record<string, unknown>)
          : null;
      }
      case 'armarios': {
        const row = await getDb().armario.findUnique({
          where: { id: BigInt(id) },
        });
        return row
          ? ({
              ...row,
              id: row.id.toString(),
            } as Record<string, unknown>)
          : null;
      }
      case 'gavetas': {
        const row = await getDb().gaveta.findUnique({
          where: { id: BigInt(id) },
        });
        return row
          ? ({
              ...row,
              id: row.id.toString(),
            } as Record<string, unknown>)
          : null;
      }
      case 'estoque': {
        const med = await getDb().estoqueMedicamento.findUnique({
          where: { id },
        });
        if (med) return { ...med } as Record<string, unknown>;
        const inp = await getDb().estoqueInsumo.findUnique({ where: { id } });
        return inp ? ({ ...inp } as Record<string, unknown>) : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
