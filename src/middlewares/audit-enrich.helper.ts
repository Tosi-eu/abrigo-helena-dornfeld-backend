import { getDb } from '@repositories/prisma';

function toPositiveId(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return !Number.isNaN(n) && n > 0 ? n : null;
}

function collectIds(
  obj: Record<string, unknown>,
  medicamentoIds: Set<number>,
  insumoIds: Set<number>,
): void {
  const medId = toPositiveId(obj.medicamento_id);
  if (medId != null) medicamentoIds.add(medId);
  const inpId = toPositiveId(obj.insumo_id);
  if (inpId != null) insumoIds.add(inpId);

  const data = obj.data;
  if (data != null && typeof data === 'object' && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    if (
      d.source != null &&
      typeof d.source === 'object' &&
      !Array.isArray(d.source)
    ) {
      collectIds(
        d.source as Record<string, unknown>,
        medicamentoIds,
        insumoIds,
      );
    }
    if (
      d.target != null &&
      typeof d.target === 'object' &&
      !Array.isArray(d.target)
    ) {
      collectIds(
        d.target as Record<string, unknown>,
        medicamentoIds,
        insumoIds,
      );
    }
    if (d.medicamento_id != null || d.insumo_id != null) {
      collectIds(d, medicamentoIds, insumoIds);
    }
  }
}

function applyNames(
  obj: Record<string, unknown>,
  medMap: Map<number, string>,
  inpMap: Map<number, string>,
): void {
  const medId = toPositiveId(obj.medicamento_id);
  if (medId != null) obj.medicamento_nome = medMap.get(medId) ?? null;
  const inpId = toPositiveId(obj.insumo_id);
  if (inpId != null) obj.insumo_nome = inpMap.get(inpId) ?? null;

  const data = obj.data;
  if (data != null && typeof data === 'object' && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    if (
      d.source != null &&
      typeof d.source === 'object' &&
      !Array.isArray(d.source)
    ) {
      applyNames(d.source as Record<string, unknown>, medMap, inpMap);
    }
    if (
      d.target != null &&
      typeof d.target === 'object' &&
      !Array.isArray(d.target)
    ) {
      applyNames(d.target as Record<string, unknown>, medMap, inpMap);
    }
    if (d.medicamento_id != null || d.insumo_id != null) {
      applyNames(d, medMap, inpMap);
    }
  }
}

export async function enrichAuditEventsBatch(
  values: (Record<string, unknown> | null)[],
): Promise<(Record<string, unknown> | null)[]> {
  const medicamentoIds = new Set<number>();
  const insumoIds = new Set<number>();

  for (const val of values) {
    if (val != null && typeof val === 'object' && !Array.isArray(val)) {
      collectIds(val, medicamentoIds, insumoIds);
    }
  }

  const [medicines, inputs] = await Promise.all([
    medicamentoIds.size > 0
      ? getDb().medicamento.findMany({
          where: { id: { in: Array.from(medicamentoIds) } },
          select: { id: true, nome: true },
        })
      : [],
    insumoIds.size > 0
      ? getDb().insumo.findMany({
          where: { id: { in: Array.from(insumoIds) } },
          select: { id: true, nome: true },
        })
      : [],
  ]);

  const medMap = new Map<number, string>();
  for (const m of medicines) {
    medMap.set(m.id, m.nome);
  }
  const inpMap = new Map<number, string>();
  for (const i of inputs) {
    inpMap.set(i.id, i.nome);
  }

  const result: (Record<string, unknown> | null)[] = [];
  for (const val of values) {
    if (val == null || typeof val !== 'object' || Array.isArray(val)) {
      result.push(val as Record<string, unknown> | null);
    } else {
      const obj = { ...val };
      applyNames(obj, medMap, inpMap);
      result.push(obj);
    }
  }
  return result;
}
