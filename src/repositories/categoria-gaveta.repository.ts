import { getDb } from '@repositories/prisma';

export class PrismaDrawerCategoryRepository {
  async create(nome: string, tenantId: number) {
    return getDb().categoriaGaveta.create({
      data: { nome, tenant_id: tenantId },
    });
  }

  async list(page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      getDb().categoriaGaveta.findMany({
        skip: offset,
        take: limit,
        orderBy: { nome: 'asc' },
      }),
      getDb().categoriaGaveta.count(),
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

  async findById(id: number) {
    return getDb().categoriaGaveta.findUnique({ where: { id } });
  }

  async findByName(nome: string, tenantId: number) {
    return getDb().categoriaGaveta.findFirst({
      where: { nome, tenant_id: tenantId },
    });
  }

  async update(id: number, nome: string) {
    try {
      return await getDb().categoriaGaveta.update({
        where: { id },
        data: { nome },
      });
    } catch {
      return null;
    }
  }

  async delete(id: number) {
    try {
      await getDb().categoriaGaveta.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
