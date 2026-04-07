import { getDb } from '@repositories/prisma';

export class PrismaResidentRepository {
  async findAll(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      getDb().residente.findMany({
        skip: offset,
        take: limit,
        orderBy: { num_casela: 'asc' },
      }),
      getDb().residente.count(),
    ]);

    return {
      data: rows.map(r => ({ casela: r.num_casela, name: r.nome })),
      hasNext: offset + rows.length < count,
    };
  }

  async findByCasela(casela: number) {
    const row = await getDb().residente.findFirst({
      where: { num_casela: casela },
    });
    if (!row) return null;
    return { casela: row.num_casela, name: row.nome };
  }

  async createResident(data: {
    num_casela: number;
    nome: string;
    tenant_id: number;
  }) {
    const row = await getDb().residente.create({
      data: {
        num_casela: data.num_casela,
        nome: data.nome,
        tenant_id: data.tenant_id,
      },
    });
    return {
      id: Number(row.id),
      casela: row.num_casela,
      name: row.nome,
    };
  }

  async updateResidentById(data: {
    num_casela: number;
    nome: string;
    tenant_id: number;
  }) {
    const row = await getDb().residente.findFirst({
      where: { num_casela: data.num_casela },
    });
    if (!row) return null;

    const updated = await getDb().residente.update({
      where: { id: row.id },
      data: { nome: data.nome },
    });
    return { casela: data.num_casela, name: updated.nome };
  }

  async deleteResidentById(casela: number): Promise<boolean> {
    try {
      const row = await getDb().residente.findFirst({
        where: { num_casela: casela },
      });
      if (!row) return false;
      await getDb().residente.delete({ where: { id: row.id } });
      return true;
    } catch {
      return false;
    }
  }

  async countMedicationsByCasela(casela: number): Promise<number> {
    return getDb().estoqueMedicamento.count({
      where: { casela_id: casela },
    });
  }

  async count(): Promise<number> {
    return getDb().residente.count();
  }
}
