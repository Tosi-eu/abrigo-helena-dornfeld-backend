import type { Prisma } from '@prisma/client';
import type { Medicine } from '@stokio/sdk';
import { getDb } from '@repositories/prisma';

function db(tx?: Prisma.TransactionClient) {
  return tx ?? getDb();
}

export class PrismaMedicineRepository {
  async createMedicine(
    data: Medicine,
    tenantId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Medicine> {
    const record = await db(tx).medicamento.create({
      data: {
        tenant_id: tenantId,
        nome: data.nome,
        dosagem: data.dosagem,
        unidade_medida: data.unidade_medida,
        principio_ativo: data.principio_ativo ?? '',
        estoque_minimo: data.estoque_minimo ?? 0,
        preco: data.preco ?? null,
      },
    });

    return {
      id: record.id,
      nome: record.nome,
      dosagem: record.dosagem,
      unidade_medida: record.unidade_medida,
      estoque_minimo: record.estoque_minimo ?? undefined,
      principio_ativo: record.principio_ativo,
      preco: record.preco != null ? Number(record.preco) : null,
    };
  }

  async findAllMedicines({
    tenantId,
    page,
    limit,
    name,
  }: {
    tenantId: number;
    page: number;
    limit: number;
    name?: string;
  }) {
    const offset = (page - 1) * limit;

    const where: Prisma.MedicamentoWhereInput = {
      tenant_id: tenantId,
      deleted_at: null,
    };
    const trimmed = name?.trim();
    if (trimmed) {
      where.nome = { contains: trimmed, mode: 'insensitive' };
    }

    const [rows, count] = await Promise.all([
      getDb().medicamento.findMany({
        where,
        orderBy: { nome: 'asc' },
        skip: offset,
        take: limit,
      }),
      getDb().medicamento.count({ where }),
    ]);

    return {
      data: rows.map(r => ({
        id: r.id,
        nome: r.nome,
        dosagem: r.dosagem,
        unidade_medida: r.unidade_medida,
        estoque_minimo: r.estoque_minimo ?? undefined,
        principio_ativo: r.principio_ativo,
        preco: r.preco != null ? Number(r.preco) : null,
      })),
      total: count,
      page,
      limit,
      hasNext: count > page * limit,
    };
  }

  async findMedicineById(
    tenantId: number,
    id: number,
  ): Promise<Medicine | null> {
    const row = await getDb().medicamento.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
    });
    return row
      ? {
          id: row.id,
          nome: row.nome,
          dosagem: row.dosagem,
          unidade_medida: row.unidade_medida,
          estoque_minimo: row.estoque_minimo ?? undefined,
          principio_ativo: row.principio_ativo,
          preco: row.preco != null ? Number(row.preco) : null,
        }
      : null;
  }

  async findByUniqueFields(
    tenantId: number,
    fields: {
      nome: string;
      principio_ativo: string;
      dosagem: string;
      unidade_medida: string;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<Medicine | null> {
    const row = await db(tx).medicamento.findFirst({
      where: {
        tenant_id: tenantId,
        nome: fields.nome,
        principio_ativo: fields.principio_ativo,
        dosagem: fields.dosagem,
        unidade_medida: fields.unidade_medida,
        deleted_at: null,
      },
    });
    return row
      ? {
          id: row.id,
          nome: row.nome,
          dosagem: row.dosagem,
          unidade_medida: row.unidade_medida,
          estoque_minimo: row.estoque_minimo ?? undefined,
          principio_ativo: row.principio_ativo,
          preco: row.preco != null ? Number(row.preco) : null,
        }
      : null;
  }

  async updateMedicineById(
    tenantId: number,
    id: number,
    data: Partial<Omit<Medicine, 'id'>>,
    tx?: Prisma.TransactionClient,
  ): Promise<Medicine | null> {
    const res = await db(tx).medicamento.updateMany({
      where: { id, tenant_id: tenantId, deleted_at: null },
      data: {
        ...data,
        preco: data.preco ?? undefined,
        ...(data.preco !== undefined ? { preco_busca_tentativas: 0 } : {}),
      },
    });
    if (res.count === 0) return null;
    return this.findMedicineById(tenantId, id);
  }

  async deleteMedicineById(tenantId: number, id: number): Promise<boolean> {
    const res = await getDb().medicamento.updateMany({
      where: { id, tenant_id: tenantId, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    return res.count > 0;
  }

  async applySoftDeleteIfNoStock(
    tenantId: number,
    medicamentoId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = db(tx);
    const agg = await client.estoqueMedicamento.aggregate({
      where: { tenant_id: tenantId, medicamento_id: medicamentoId },
      _sum: { quantidade: true },
    });
    const total = Number(agg._sum.quantidade ?? 0);
    if (total !== 0) return;

    await client.medicamento.updateMany({
      where: {
        id: medicamentoId,
        tenant_id: tenantId,
        deleted_at: null,
      },
      data: { deleted_at: new Date() },
    });
  }
}
