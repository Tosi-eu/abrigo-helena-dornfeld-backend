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

  async findAllDrawers(page: number, limit: number) {
    const offset = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      getDb().gaveta.findMany({
        orderBy: { num_gaveta: 'asc' },
        take: limit,
        skip: offset,
      }),
      getDb().gaveta.count(),
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

    return {
      data,
      total: count,
      page,
      limit,
      hasNext: offset + data.length < count,
    };
  }

  async findByDrawerNumber(number: number): Promise<DrawerPersist | null> {
    const item = await getDb().gaveta.findFirst({
      where: { num_gaveta: number },
    });
    if (!item) return null;

    return {
      numero: item.num_gaveta,
      categoria_id: item.categoria_id,
    };
  }

  async update(
    number: number,
    categoria_id: number,
  ): Promise<DrawerPersist | null> {
    const item = await getDb().gaveta.findFirst({
      where: { num_gaveta: number },
    });
    if (!item) return null;

    const updated = await getDb().gaveta.update({
      where: { id: item.id },
      data: { categoria_id },
    });

    return {
      numero: updated.num_gaveta,
      categoria_id: updated.categoria_id,
    };
  }

  async delete(number: number): Promise<boolean> {
    const item = await getDb().gaveta.findFirst({
      where: { num_gaveta: number },
    });
    if (!item) return false;
    try {
      await getDb().gaveta.delete({ where: { id: item.id } });
      return true;
    } catch {
      return false;
    }
  }

  async count(): Promise<number> {
    return getDb().gaveta.count();
  }
}
