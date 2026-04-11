import type { Prisma, Setor } from '@prisma/client';
import { getDb } from '@repositories/prisma';

function db(tx?: Prisma.TransactionClient) {
  return tx ?? getDb();
}

export type ProportionProfile = 'farmacia' | 'enfermagem';

export class PrismaSetorRepository {
  async listByTenant(
    tenantId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Setor[]> {
    return db(tx).setor.findMany({
      where: { tenant_id: tenantId, active: true },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });
  }

  async findByTenantAndKey(
    tenantId: number,
    key: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Setor | null> {
    const k = String(key).trim().toLowerCase();
    return db(tx).setor.findFirst({
      where: { tenant_id: tenantId, key: k, active: true },
    });
  }

  async findByIdForTenant(
    tenantId: number,
    id: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Setor | null> {
    return db(tx).setor.findFirst({
      where: { id, tenant_id: tenantId, active: true },
    });
  }

  /** Garante os setores padrão (chaves farmacia / enfermagem) para o tenant. */
  async ensureDefaultSetores(
    tenantId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = db(tx);
    const defaults: Array<{
      key: string;
      nome: string;
      proportion_profile: ProportionProfile;
      sort_order: number;
    }> = [
      {
        key: 'farmacia',
        nome: 'Farmácia',
        proportion_profile: 'farmacia',
        sort_order: 0,
      },
      {
        key: 'enfermagem',
        nome: 'Enfermagem',
        proportion_profile: 'enfermagem',
        sort_order: 1,
      },
    ];
    for (const d of defaults) {
      const exists = await client.setor.findFirst({
        where: { tenant_id: tenantId, key: d.key },
      });
      if (exists) continue;
      await client.setor.create({
        data: {
          tenant_id: tenantId,
          key: d.key,
          nome: d.nome,
          proportion_profile: d.proportion_profile,
          sort_order: d.sort_order,
          active: true,
        },
      });
    }
  }

  async createCustom(params: {
    tenantId: number;
    key: string;
    nome: string;
    proportionProfile: ProportionProfile;
    tx?: Prisma.TransactionClient;
  }): Promise<Setor> {
    const key = String(params.key).trim().toLowerCase();
    const nome = String(params.nome).trim();
    if (!key || !nome) {
      throw new Error('Chave e nome do setor são obrigatórios');
    }
    if (key.length > 64 || nome.length > 120) {
      throw new Error('Chave ou nome do setor excede o tamanho permitido');
    }
    if (!/^[a-z0-9_]+$/.test(key)) {
      throw new Error(
        'Chave do setor: use apenas letras minúsculas, números e sublinhado',
      );
    }
    if (
      params.proportionProfile !== 'farmacia' &&
      params.proportionProfile !== 'enfermagem'
    ) {
      throw new Error('Perfil de proporção inválido');
    }
    const client = db(params.tx);
    const maxRow = await client.setor.findFirst({
      where: { tenant_id: params.tenantId },
      orderBy: { sort_order: 'desc' },
      select: { sort_order: true },
    });
    const sortOrder = (maxRow?.sort_order ?? -1) + 1;
    return client.setor.create({
      data: {
        tenant_id: params.tenantId,
        key,
        nome,
        proportion_profile: params.proportionProfile,
        sort_order: sortOrder,
        active: true,
      },
    });
  }

  async keysExistForTenant(
    tenantId: number,
    keys: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    if (keys.length === 0) return false;
    const normalized = [
      ...new Set(keys.map(k => String(k).trim().toLowerCase())),
    ];
    const count = await db(tx).setor.count({
      where: {
        tenant_id: tenantId,
        active: true,
        key: { in: normalized },
      },
    });
    return count === normalized.length;
  }
}
