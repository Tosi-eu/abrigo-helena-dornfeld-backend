import { getDb } from '@repositories/prisma';

export class PrismaResidentRepository {
  async findAll(tenantId: number, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      getDb().residente.findMany({
        where: { tenant_id: tenantId },
        skip: offset,
        take: limit,
        orderBy: { num_casela: 'asc' },
      }),
      getDb().residente.count({ where: { tenant_id: tenantId } }),
    ]);

    return {
      data: rows.map(r => ({ casela: r.num_casela, name: r.nome })),
      hasNext: offset + rows.length < count,
    };
  }

  async findByCasela(tenantId: number, casela: number) {
    const row = await getDb().residente.findFirst({
      where: { num_casela: casela, tenant_id: tenantId },
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
    const res = await getDb().residente.updateMany({
      where: { num_casela: data.num_casela, tenant_id: data.tenant_id },
      data: { nome: data.nome },
    });
    if (res.count === 0) return null;
    return { casela: data.num_casela, name: data.nome };
  }

  async deleteResidentById(tenantId: number, casela: number): Promise<boolean> {
    const res = await getDb().residente.deleteMany({
      where: { num_casela: casela, tenant_id: tenantId },
    });
    return res.count > 0;
  }

  async countMedicationsByCasela(
    tenantId: number,
    casela: number,
  ): Promise<number> {
    return getDb().estoqueMedicamento.count({
      where: { tenant_id: tenantId, casela_id: casela },
    });
  }

  async count(tenantId: number): Promise<number> {
    return getDb().residente.count({ where: { tenant_id: tenantId } });
  }
}
