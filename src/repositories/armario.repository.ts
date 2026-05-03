import type { CabinetPersist } from '@porto-sdk/sdk';
import { getDb } from '@repositories/prisma';

export class PrismaCabinetRepository {
  async createCabinet(
    data: CabinetPersist,
    tenantId: number,
  ): Promise<CabinetPersist> {
    const item = await getDb().armario.create({
      data: {
        tenant_id: tenantId,
        num_armario: data.numero,
        categoria_id: data.categoria_id,
      },
    });
    return {
      numero: item.num_armario,
      categoria_id: item.categoria_id,
    };
  }

  async findAllCabinets(tenantId: number, page: number, limit: number) {
    const offset = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      getDb().armario.findMany({
        where: { tenant_id: tenantId },
        orderBy: { num_armario: 'asc' },
        take: limit,
        skip: offset,
      }),
      getDb().armario.count({ where: { tenant_id: tenantId } }),
    ]);

    const catIds = [...new Set(rows.map(r => r.categoria_id))];
    const cats =
      catIds.length > 0
        ? await getDb().categoriaArmario.findMany({
            where: { id: { in: catIds } },
            select: { id: true, nome: true },
          })
        : [];
    const catNome = new Map(cats.map(c => [c.id, c.nome]));

    const data = rows.map(i => ({
      numero: i.num_armario,
      categoria_id: i.categoria_id,
      categoria: catNome.get(i.categoria_id) ?? null,
    }));

    data.sort((a, b) => {
      const an = (a.categoria ?? '').trim();
      const bn = (b.categoria ?? '').trim();
      if (an && bn) {
        const byName = an.localeCompare(bn, 'pt-BR', { sensitivity: 'base' });
        if (byName !== 0) return byName;
      } else if (an && !bn) {
        return -1;
      } else if (!an && bn) {
        return 1;
      }
      return Number(a.numero) - Number(b.numero);
    });

    return {
      data,
      total: count,
      page,
      limit,
      hasNext: offset + data.length < count,
    };
  }

  async findByCabinetNumber(
    tenantId: number,
    number: number,
  ): Promise<CabinetPersist | null> {
    const item = await getDb().armario.findFirst({
      where: { tenant_id: tenantId, num_armario: number },
    });
    if (!item) return null;
    return {
      numero: item.num_armario,
      categoria_id: item.categoria_id,
    };
  }

  async update(
    tenantId: number,
    number: number,
    categoria_id: number,
  ): Promise<CabinetPersist | null> {
    const res = await getDb().armario.updateMany({
      where: { tenant_id: tenantId, num_armario: number },
      data: { categoria_id },
    });
    if (res.count === 0) return null;
    return {
      numero: number,
      categoria_id,
    };
  }

  async delete(tenantId: number, number: number): Promise<boolean> {
    const res = await getDb().armario.deleteMany({
      where: { tenant_id: tenantId, num_armario: number },
    });
    return res.count > 0;
  }

  async countMedicine(tenantId: number, number: number): Promise<number> {
    return getDb().estoqueMedicamento.count({
      where: { tenant_id: tenantId, armario_id: number },
    });
  }

  async countInput(tenantId: number, number: number): Promise<number> {
    return getDb().estoqueInsumo.count({
      where: { tenant_id: tenantId, armario_id: number },
    });
  }

  async count(tenantId: number): Promise<number> {
    return getDb().armario.count({ where: { tenant_id: tenantId } });
  }
}
