import type { Prisma } from '@prisma/client';
import type { Input } from '@stokio/sdk';
import { getDb } from '@repositories/prisma';

function db(tx?: Prisma.TransactionClient) {
  return tx ?? getDb();
}

export class PrismaInputRepository {
  async createInput(
    data: Omit<Input, 'id'>,
    tenantId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Input> {
    const input = await db(tx).insumo.create({
      data: {
        tenant_id: tenantId,
        nome: data.nome,
        descricao: data.descricao ?? null,
        estoque_minimo: data.estoque_minimo ?? null,
        preco: data.preco ?? null,
      },
    });
    return {
      id: input.id,
      nome: input.nome,
      descricao: input.descricao ?? '',
      estoque_minimo: input.estoque_minimo ?? undefined,
      preco: input.preco != null ? Number(input.preco) : null,
    };
  }

  async listAllInputs(
    tenantId: number,
    page: number = 1,
    limit: number = 10,
    name?: string,
  ): Promise<{
    data: Input[];
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
  }> {
    const offset = (page - 1) * limit;

    const where: Prisma.InsumoWhereInput = {};
    where.tenant_id = tenantId;
    const trimmed = name?.trim();
    if (trimmed) {
      where.nome = { contains: trimmed, mode: 'insensitive' };
    }

    const [rows, count] = await Promise.all([
      getDb().insumo.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { nome: 'asc' },
      }),
      getDb().insumo.count({ where }),
    ]);

    return {
      data: rows.map(r => ({
        id: r.id,
        nome: r.nome,
        descricao: r.descricao ?? '',
        estoque_minimo: r.estoque_minimo ?? undefined,
        preco: r.preco != null ? Number(r.preco) : null,
      })),
      total: count,
      page,
      limit,
      hasNext: offset + rows.length < count,
    };
  }

  async findInputById(tenantId: number, id: number): Promise<Input | null> {
    const insumo = await getDb().insumo.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!insumo) return null;

    return {
      id: insumo.id,
      nome: insumo.nome,
      descricao: insumo.descricao ?? '',
      estoque_minimo: insumo.estoque_minimo ?? undefined,
      preco: insumo.preco != null ? Number(insumo.preco) : null,
    };
  }

  async updateInputById(
    tenantId: number,
    id: number,
    data: Partial<Omit<Input, 'id'>>,
    tx?: Prisma.TransactionClient,
  ): Promise<Input | null> {
    const res = await db(tx).insumo.updateMany({
      where: { id, tenant_id: tenantId },
      data: {
        ...data,
        preco: data.preco ?? undefined,
      },
    });
    if (res.count === 0) return null;
    return this.findInputById(tenantId, id);
  }

  async deleteInputById(tenantId: number, id: number): Promise<boolean> {
    const res = await getDb().insumo.deleteMany({
      where: { id, tenant_id: tenantId },
    });
    return res.count > 0;
  }
}
