import type { AuthRequest } from './auth.middleware';
import MedicineModel from '../infrastructure/database/models/medicamento.model';
import InputModel from '../infrastructure/database/models/insumo.model';
import ResidentModel from '../infrastructure/database/models/residente.model';
import CabinetModel from '../infrastructure/database/models/armario.model';
import DrawerModel from '../infrastructure/database/models/gaveta.model';
import MedicineStockModel from '../infrastructure/database/models/estoque-medicamento.model';
import InputStockModel from '../infrastructure/database/models/estoque-insumo.model';
import LoginModel from '../infrastructure/database/models/login.model';
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
      const row = await LoginModel.findByPk(req.user.id);
      if (!row) return null;
      const plain = row.get({ plain: true }) as Record<string, unknown>;
      delete plain.password;
      delete plain.refresh_token;
      return plain;
    } catch {
      return null;
    }
  }

  if (resource === 'admin' && segments[1] === 'users' && segments[2]) {
    const id = Number(segments[2]);
    if (!Number.isNaN(id)) {
      try {
        const row = await LoginModel.findByPk(id);
        if (!row) return null;
        const plain = row.get({ plain: true }) as Record<string, unknown>;
        delete plain.password;
        delete plain.refresh_token;
        return plain;
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

  const toRecord = (row: { get: (opts: { plain: true }) => unknown }) =>
    row.get({ plain: true }) as Record<string, unknown>;

  try {
    switch (resource) {
      case 'medicamentos': {
        const row = await MedicineModel.findByPk(id);
        return row ? toRecord(row) : null;
      }
      case 'insumos': {
        const row = await InputModel.findByPk(id);
        return row ? toRecord(row) : null;
      }
      case 'residentes': {
        const row = await ResidentModel.findByPk(id);
        return row ? toRecord(row) : null;
      }
      case 'armarios': {
        const row = await CabinetModel.findByPk(id);
        return row ? toRecord(row) : null;
      }
      case 'gavetas': {
        const row = await DrawerModel.findByPk(id);
        return row ? toRecord(row) : null;
      }
      case 'estoque': {
        const med = await MedicineStockModel.findByPk(id);
        if (med) return toRecord(med);
        const inp = await InputStockModel.findByPk(id);
        return inp ? toRecord(inp) : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
