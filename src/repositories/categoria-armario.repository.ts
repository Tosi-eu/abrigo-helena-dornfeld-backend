import { getDb } from '@repositories/prisma';

export class PrismaCabinetCategoryRepository {
  async create(nome: string, tenantId: number) {
    return getDb().categoriaArmario.create({
      data: { nome, tenant_id: tenantId },
    });
  }

  async list(tenantId: number, page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      getDb().categoriaArmario.findMany({
        where: { tenant_id: tenantId },
        skip: offset,
        take: limit,
        orderBy: { nome: 'asc' },
      }),
      getDb().categoriaArmario.count({ where: { tenant_id: tenantId } }),
    ]);

    return {
      data: rows.map(r => ({
        id: r.id,
        nome: r.nome,
      })),
      total: count,
      page,
      limit,
      hasNext: offset + rows.length < count,
    };
  }

  async findById(tenantId: number, id: number) {
    return getDb().categoriaArmario.findFirst({
      where: { id, tenant_id: tenantId },
    });
  }

  async findByName(nome: string, tenantId: number) {
    return getDb().categoriaArmario.findFirst({
      where: { nome, tenant_id: tenantId },
    });
  }

  async update(tenantId: number, id: number, nome: string) {
    const res = await getDb().categoriaArmario.updateMany({
      where: { tenant_id: tenantId, id },
      data: { nome },
    });
    if (res.count === 0) return null;
    return this.findById(tenantId, id);
  }

  async delete(tenantId: number, id: number) {
    const res = await getDb().categoriaArmario.deleteMany({
      where: { tenant_id: tenantId, id },
    });
    return res.count > 0;
  }
}
