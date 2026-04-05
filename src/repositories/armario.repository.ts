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

  async findAllCabinets(page: number, limit: number) {
    const offset = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      getDb().armario.findMany({
        orderBy: { num_armario: 'asc' },
        take: limit,
        skip: offset,
      }),
      getDb().armario.count(),
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

    return {
      data,
      total: count,
      page,
      limit,
      hasNext: offset + data.length < count,
    };
  }

  async findByCabinetNumber(number: number): Promise<CabinetPersist | null> {
    const item = await getDb().armario.findFirst({
      where: { num_armario: number },
    });
    if (!item) return null;
    return {
      numero: item.num_armario,
      categoria_id: item.categoria_id,
    };
  }

  async update(
    number: number,
    categoria_id: number,
  ): Promise<CabinetPersist | null> {
    const item = await getDb().armario.findFirst({
      where: { num_armario: number },
    });
    if (!item) return null;
    const updated = await getDb().armario.update({
      where: { id: item.id },
      data: { categoria_id },
    });
    return {
      numero: updated.num_armario,
      categoria_id: updated.categoria_id,
    };
  }

  async delete(number: number): Promise<boolean> {
    const item = await getDb().armario.findFirst({
      where: { num_armario: number },
    });
    if (!item) return false;
    try {
      await getDb().armario.delete({ where: { id: item.id } });
      return true;
    } catch {
      return false;
    }
  }

  async countMedicine(number: number): Promise<number> {
    return getDb().estoqueMedicamento.count({
      where: { armario_id: number },
    });
  }

  async countInput(number: number): Promise<number> {
    return getDb().estoqueInsumo.count({
      where: { armario_id: number },
    });
  }

  async count(): Promise<number> {
    return getDb().armario.count();
  }
}
