import type { DrawerPersist } from '@porto-sdk/sdk';
import { getDb } from '@repositories/prisma';

export class PrismaDrawerRepository {
  async createDrawer(
    data: DrawerPersist,
    tenantId: number,
  ): Promise<DrawerPersist> {
    const item = await getDb().gaveta.create({
      data: {
        tenant_id: tenantId,
        num_gaveta: data.numero,
        categoria_id: data.categoria_id,
      },
    });

    return {
      numero: item.num_gaveta,
      categoria_id: item.categoria_id,
    };
  }

  async findAllDrawers(tenantId: number, page: number, limit: number) {
    const offset = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      getDb().gaveta.findMany({
        where: { tenant_id: tenantId },
        orderBy: { num_gaveta: 'asc' },
        take: limit,
        skip: offset,
      }),
      getDb().gaveta.count({ where: { tenant_id: tenantId } }),
    ]);

    const catIds = [...new Set(rows.map(r => r.categoria_id))];
    const cats =
      catIds.length > 0
        ? await getDb().categoriaGaveta.findMany({
            where: { id: { in: catIds } },
            select: { id: true, nome: true },
          })
        : [];
    const catNome = new Map(cats.map(c => [c.id, c.nome]));

    const data = rows.map(i => ({
      numero: i.num_gaveta,
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

  async findByDrawerNumber(
    tenantId: number,
    number: number,
  ): Promise<DrawerPersist | null> {
    const item = await getDb().gaveta.findFirst({
      where: { tenant_id: tenantId, num_gaveta: number },
    });
    if (!item) return null;

    return {
      numero: item.num_gaveta,
      categoria_id: item.categoria_id,
    };
  }

  async update(
    tenantId: number,
    number: number,
    categoria_id: number,
  ): Promise<DrawerPersist | null> {
    const res = await getDb().gaveta.updateMany({
      where: { tenant_id: tenantId, num_gaveta: number },
      data: { categoria_id },
    });
    if (res.count === 0) return null;

    return {
      numero: number,
      categoria_id,
    };
  }

  async delete(tenantId: number, number: number): Promise<boolean> {
    const res = await getDb().gaveta.deleteMany({
      where: { tenant_id: tenantId, num_gaveta: number },
    });
    return res.count > 0;
  }

  async count(tenantId: number): Promise<number> {
    return getDb().gaveta.count({ where: { tenant_id: tenantId } });
  }
}
