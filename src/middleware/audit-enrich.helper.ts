import MedicineModel from '../infrastructure/database/models/medicamento.model';
import InputModel from '../infrastructure/database/models/insumo.model';

function toPositiveId(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return !Number.isNaN(n) && n > 0 ? n : null;
}

async function addMedicamentoNome(obj: Record<string, unknown>): Promise<void> {
  const medicamentoId = toPositiveId(obj.medicamento_id);
  if (medicamentoId == null) return;
  try {
    const med = await MedicineModel.findByPk(medicamentoId);
    if (med) {
      const m = med.get({ plain: true }) as { nome?: string };
      obj.medicamento_nome = m.nome ?? null;
    }
  } catch {
    obj.medicamento_nome = null;
  }
}

async function addInsumoNome(obj: Record<string, unknown>): Promise<void> {
  const insumoId = toPositiveId(obj.insumo_id);
  if (insumoId == null) return;
  try {
    const inp = await InputModel.findByPk(insumoId);
    if (inp) {
      const i = inp.get({ plain: true }) as { nome?: string };
      obj.insumo_nome = i.nome ?? null;
    }
  } catch {
    obj.insumo_nome = null;
  }
}

async function enrichOne(val: Record<string, unknown>): Promise<Record<string, unknown>> {
  const obj = { ...val };
  await Promise.all([addMedicamentoNome(obj), addInsumoNome(obj)]);
  return obj;
}

/**
 * Enriches audit values with medicamento_nome and insumo_nome when medicamento_id
 * or insumo_id are present, so users see the medicine/input name instead of just the ID.
 * Handles plain objects, { message, data }, and { data: { source, target } }.
 */
export async function enrichAuditValue(
  val: Record<string, unknown> | null | undefined,
): Promise<Record<string, unknown> | null> {
  if (val == null || typeof val !== 'object' || Array.isArray(val)) {
    return val as Record<string, unknown> | null;
  }

  const obj = { ...val };

  // { message, data } - data can be entity or { source, target }
  const data = obj.data;
  if (data != null && typeof data === 'object' && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    if (d.source != null && typeof d.source === 'object' && !Array.isArray(d.source)) {
      d.source = await enrichOne(d.source as Record<string, unknown>);
    }
    if (d.target != null && typeof d.target === 'object' && !Array.isArray(d.target)) {
      d.target = await enrichOne(d.target as Record<string, unknown>);
    }
    if (d.medicamento_id != null || d.insumo_id != null) {
      const enriched = await enrichOne(d);
      d.medicamento_nome = enriched.medicamento_nome;
      d.insumo_nome = enriched.insumo_nome;
    }
    return obj;
  }

  return enrichOne(obj);
}
