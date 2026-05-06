import type { Prisma } from '@prisma/client';
import { getDb } from '@repositories/prisma';
import {
  computeAgeFromBirthDate,
  formatDateOnlyIsoUtc,
} from '@helpers/resident-age.helper';

function db(tx?: Prisma.TransactionClient) {
  return tx ?? getDb();
}

export type ResidentApiRow = {
  casela: number;
  name: string;
  cpf: string | null;
  data_nascimento: string | null;
  idade: number | null;
};

function mapResidentRow(r: {
  num_casela: number;
  nome: string;
  cpf?: string | null;
  data_nascimento: Date | null;
}): ResidentApiRow {
  const birth = r.data_nascimento;
  return {
    casela: r.num_casela,
    name: r.nome,
    cpf: r.cpf ? String(r.cpf) : null,
    data_nascimento: birth ? formatDateOnlyIsoUtc(birth) : null,
    idade: birth ? computeAgeFromBirthDate(birth) : null,
  };
}

export class PrismaResidentRepository {
  async findAll(
    tenantId: number,
    page: number = 1,
    limit: number = 20,
    tx?: Prisma.TransactionClient,
  ) {
    const offset = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      db(tx).residente.findMany({
        where: { tenant_id: tenantId },
        skip: offset,
        take: limit,
        orderBy: { num_casela: 'asc' },
      }),
      db(tx).residente.count({ where: { tenant_id: tenantId } }),
    ]);

    return {
      data: rows.map(r => mapResidentRow(r)),
      hasNext: offset + rows.length < count,
    };
  }

  async findByCasela(tenantId: number, casela: number) {
    const row = await getDb().residente.findFirst({
      where: { num_casela: casela, tenant_id: tenantId },
    });
    if (!row) return null;
    return mapResidentRow(row);
  }

  async createResident(
    data: {
      num_casela: number;
      nome: string;
      cpf?: string | null;
      tenant_id: number;
      data_nascimento?: Date | null;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const row = await db(tx).residente.create({
      data: {
        num_casela: data.num_casela,
        nome: data.nome,
        cpf: data.cpf ?? undefined,
        tenant_id: data.tenant_id,
        data_nascimento: data.data_nascimento ?? undefined,
      },
    });
    return {
      id: Number(row.id),
      ...mapResidentRow(row),
    };
  }

  async updateResidentById(
    data: {
      num_casela: number;
      nome: string;
      cpf?: string | null;
      tenant_id: number;
      data_nascimento?: Date | null;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const updateData: {
      nome: string;
      cpf?: string | null;
      data_nascimento?: Date | null;
    } = { nome: data.nome };
    if (Object.prototype.hasOwnProperty.call(data, 'data_nascimento')) {
      updateData.data_nascimento = data.data_nascimento ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'cpf')) {
      updateData.cpf = data.cpf ?? null;
    }
    const res = await db(tx).residente.updateMany({
      where: { num_casela: data.num_casela, tenant_id: data.tenant_id },
      data: updateData,
    });
    if (res.count === 0) return null;
    const row = await db(tx).residente.findFirst({
      where: { num_casela: data.num_casela, tenant_id: data.tenant_id },
    });
    return row ? mapResidentRow(row) : null;
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
