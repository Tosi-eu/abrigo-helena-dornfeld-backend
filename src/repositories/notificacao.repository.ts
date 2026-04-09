import type { Prisma } from '@prisma/client';
import { formatDateToPtBr, toBrazilDateOnly } from '@helpers/date.helper';
import {
  EventStatus,
  NotificationDestinoType,
  NotificationEventType,
  NotificationUpdateData,
} from '@domain/notificacao.types';
import { MovementType, StockItemStatus } from '@helpers/utils';
import { getDb } from '@repositories/prisma';

function db(tx?: Prisma.TransactionClient) {
  return tx ?? getDb();
}

export function getTodayInBrazil(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date());
}

export class PrismaNotificationEventRepository {
  async create(
    data: {
      tenant_id: number;
      medicamento_id: number;
      residente_id: number;
      destino: NotificationDestinoType;
      data_prevista: Date;
      criado_por: number;
      visto: boolean;
      tipo_evento: NotificationEventType;
      quantidade?: number | null;
      dias_para_repor?: number | null;
    },
    transaction?: Prisma.TransactionClient,
  ) {
    return db(transaction).notificacao.create({
      data: {
        tenant_id: data.tenant_id,
        medicamento_id: data.medicamento_id,
        residente_id: data.residente_id,
        destino: data.destino,
        data_prevista: data.data_prevista,
        criado_por: data.criado_por,
        visto: data.visto,
        tipo_evento: data.tipo_evento,
        status: EventStatus.PENDENTE,
        quantidade: data.quantidade ?? null,
        dias_para_repor: data.dias_para_repor ?? null,
      },
    });
  }

  async listWithFilters(
    {
      tenantId,
      page = 1,
      limit = 5,
      tipo,
      status = EventStatus.PENDENTE,
      date,
      residente_nome,
      visto,
    }: {
      tenantId: number;
      page?: number;
      limit?: number;
      tipo: NotificationEventType;
      status?: EventStatus;
      date?: 'today' | 'tomorrow' | string;
      residente_nome?: string;
      casela?: string | number;
      visto?: boolean;
    },
    transaction?: Prisma.TransactionClient,
  ) {
    const offset = (page - 1) * limit;

    const where: Prisma.NotificacaoWhereInput = {
      tenant_id: tenantId,
      tipo_evento: tipo,
      status,
    };

    if (date === 'today') {
      where.data_prevista = new Date(getTodayInBrazil());
    } else if (date === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      where.data_prevista = new Date(toBrazilDateOnly(tomorrow));
    } else if (date && !['today', 'tomorrow'].includes(date)) {
      where.data_prevista = new Date(date);
    }
    if (visto === false) where.visto = false;

    if (residente_nome?.trim()) {
      const res = await db(transaction).residente.findMany({
        where: {
          tenant_id: tenantId,
          nome: { contains: residente_nome.trim(), mode: 'insensitive' },
        },
        select: { num_casela: true },
      });
      const caselas = res.map(r => r.num_casela);
      if (caselas.length === 0) {
        return {
          items: [],
          total: 0,
          page,
          limit,
          hasNext: false,
        };
      }
      where.residente_id = { in: caselas };
    }

    const [rows, count] = await Promise.all([
      db(transaction).notificacao.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { data_prevista: 'asc' },
      }),
      db(transaction).notificacao.count({ where }),
    ]);

    const residenteIds = [
      ...new Set(
        rows.map(r => r.residente_id).filter((id): id is number => id != null),
      ),
    ];
    const medIds = [
      ...new Set(
        rows
          .map(r => r.medicamento_id)
          .filter((id): id is number => id != null),
      ),
    ];
    const loginIds = [...new Set(rows.map(r => r.criado_por))];

    const [residentes, medicamentos, logins] = await Promise.all([
      residenteIds.length
        ? db(transaction).residente.findMany({
            where: { tenant_id: tenantId, num_casela: { in: residenteIds } },
          })
        : [],
      medIds.length
        ? db(transaction).medicamento.findMany({
            where: { tenant_id: tenantId, id: { in: medIds } },
          })
        : [],
      loginIds.length
        ? db(transaction).login.findMany({
            where: { tenant_id: tenantId, id: { in: loginIds } },
            select: {
              id: true,
              first_name: true,
              last_name: true,
              login: true,
            },
          })
        : [],
    ]);

    const resByCasela = new Map(residentes.map(r => [r.num_casela, r.nome]));
    const medById = new Map(medicamentos.map(m => [m.id, m.nome]));
    const loginById = new Map(logins.map(l => [l.id, l]));

    let stockByKey = new Map<string, { dias_para_repor: number | null }>();
    const movByKey = new Map<string, number>();

    if (tipo === NotificationEventType.REPOSICAO_ESTOQUE && rows.length > 0) {
      const keys = rows
        .filter(
          (
            r,
          ): r is typeof r & {
            medicamento_id: number;
            residente_id: number;
          } => r.medicamento_id != null && r.residente_id != null,
        )
        .map(r => ({
          medicamento_id: r.medicamento_id,
          casela_id: r.residente_id,
        }));
      const uniqKeys = Array.from(
        new Map(
          keys.map(k => [`${k.medicamento_id}:${k.casela_id}`, k] as const),
        ).values(),
      );

      const stocks =
        uniqKeys.length > 0
          ? await db(transaction).estoqueMedicamento.findMany({
              where: {
                setor: 'enfermagem',
                status: StockItemStatus.ATIVO,
                OR: uniqKeys.map(u => ({
                  medicamento_id: u.medicamento_id,
                  casela_id: u.casela_id,
                })),
              },
            })
          : [];

      stockByKey = new Map(
        stocks.map(s => [
          `${s.medicamento_id}:${s.casela_id ?? ''}`,
          { dias_para_repor: s.dias_para_repor },
        ]),
      );

      const movs =
        uniqKeys.length > 0
          ? await db(transaction).movimentacao.findMany({
              where: {
                tipo: MovementType.TRANSFERENCIA,
                setor: 'enfermagem',
                OR: uniqKeys.map(u => ({
                  medicamento_id: u.medicamento_id,
                  casela_id: u.casela_id,
                })),
              },
              orderBy: { createdAt: 'desc' },
              select: {
                medicamento_id: true,
                casela_id: true,
                quantidade: true,
              },
            })
          : [];
      const seen = new Set<string>();
      for (const m of movs) {
        const k = `${m.medicamento_id}:${m.casela_id ?? ''}`;
        if (!seen.has(k)) {
          seen.add(k);
          movByKey.set(k, m.quantidade);
        }
      }
    }

    const items = rows.map(row => {
      const resNome =
        row.residente_id != null
          ? (resByCasela.get(row.residente_id) ?? undefined)
          : undefined;
      const medNome =
        row.medicamento_id != null
          ? (medById.get(row.medicamento_id) ?? undefined)
          : undefined;
      const u = loginById.get(row.criado_por);
      const usuarioStr = u
        ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.login
        : 'Sistema';

      const sk =
        row.medicamento_id != null && row.residente_id != null
          ? `${row.medicamento_id}:${row.residente_id}`
          : '';
      const estoque = sk ? stockByKey.get(sk) : undefined;
      const qtd =
        tipo === NotificationEventType.REPOSICAO_ESTOQUE && sk
          ? (movByKey.get(sk) ?? null)
          : undefined;

      return {
        id: row.id,
        destino: row.destino,
        data_prevista: formatDateToPtBr(row.data_prevista ?? new Date()),
        status: row.status,
        criado_por: row.criado_por,
        residente_nome: resNome,
        medicamento_nome: medNome,
        medicamento_id: row.medicamento_id,
        residente_id: row.residente_id,
        usuario: usuarioStr,
        quantidade:
          tipo === NotificationEventType.REPOSICAO_ESTOQUE ? qtd : undefined,
        visto: row.visto,
        tipo_evento: row.tipo_evento as NotificationEventType,
        dias_para_repor:
          tipo === NotificationEventType.REPOSICAO_ESTOQUE
            ? Number(estoque?.dias_para_repor ?? 0) || null
            : null,
      };
    });

    return {
      items,
      total: count,
      page,
      limit,
      hasNext: offset + rows.length < count,
    };
  }

  async listAllForAdmin(
    {
      page = 1,
      limit = 25,
      tipo,
      status,
      visto,
    }: {
      page?: number;
      limit?: number;
      tipo?: NotificationEventType;
      status?: EventStatus;
      visto?: boolean;
    },
    transaction?: Prisma.TransactionClient,
  ) {
    const offset = (page - 1) * limit;
    const where: Prisma.NotificacaoWhereInput = {};
    if (tipo) where.tipo_evento = tipo;
    if (status) where.status = status;
    if (visto !== undefined) where.visto = visto;

    const [rows, count] = await Promise.all([
      db(transaction).notificacao.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db(transaction).notificacao.count({ where }),
    ]);

    const residenteIds = [
      ...new Set(
        rows.map(r => r.residente_id).filter((id): id is number => id != null),
      ),
    ];
    const medIds = [
      ...new Set(
        rows
          .map(r => r.medicamento_id)
          .filter((id): id is number => id != null),
      ),
    ];
    const loginIds = [...new Set(rows.map(r => r.criado_por))];

    const [residentes, medicamentos, logins] = await Promise.all([
      residenteIds.length
        ? db(transaction).residente.findMany({
            where: { num_casela: { in: residenteIds } },
          })
        : [],
      medIds.length
        ? db(transaction).medicamento.findMany({
            where: { id: { in: medIds } },
          })
        : [],
      loginIds.length
        ? db(transaction).login.findMany({
            where: { id: { in: loginIds } },
            select: {
              id: true,
              first_name: true,
              last_name: true,
              login: true,
            },
          })
        : [],
    ]);

    const resByCasela = new Map(residentes.map(r => [r.num_casela, r.nome]));
    const medById = new Map(medicamentos.map(m => [m.id, m.nome]));
    const loginById = new Map(logins.map(l => [l.id, l]));

    const items = rows.map(row => {
      const resNome =
        row.residente_id != null
          ? (resByCasela.get(row.residente_id) ?? undefined)
          : undefined;
      const medNome =
        row.medicamento_id != null
          ? (medById.get(row.medicamento_id) ?? undefined)
          : undefined;
      const u = loginById.get(row.criado_por);
      const usuarioStr = u
        ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.login || ''
        : 'Sistema';

      return {
        id: row.id,
        destino: row.destino,
        data_prevista: formatDateToPtBr(row.data_prevista ?? new Date()),
        status: row.status,
        criado_por: row.criado_por,
        residente_nome: resNome,
        medicamento_nome: medNome,
        medicamento_id: row.medicamento_id,
        residente_id: row.residente_id,
        usuario: usuarioStr || 'Sistema',
        visto: row.visto,
        tipo_evento: row.tipo_evento as NotificationEventType,
      };
    });

    return {
      items,
      total: count,
      page,
      limit,
      hasNext: offset + rows.length < count,
    };
  }

  async findById(
    tenantId: number,
    id: number,
    transaction?: Prisma.TransactionClient,
  ) {
    return db(transaction).notificacao.findFirst({
      where: { tenant_id: tenantId, id },
    });
  }

  async bootstrapReplacementNotifications(
    skipTenantIds?: Set<number>,
  ): Promise<number> {
    let created = 0;

    const medicineStocks = await getDb().estoqueMedicamento.findMany({
      where: {
        dias_para_repor: { not: null },
        status: StockItemStatus.ATIVO,
        quantidade: { gte: 0 },
      },
    });

    for (const stock of medicineStocks) {
      if (!stock.ultima_reposicao || !stock.casela_id) continue;

      const stockTenantId = stock.tenant_id;
      if (stockTenantId != null && skipTenantIds?.has(Number(stockTenantId))) {
        continue;
      }

      const lastReposition = toBrazilDateOnly(stock.ultima_reposicao);
      const nextReposition = new Date(lastReposition);
      nextReposition.setDate(
        nextReposition.getDate() + Number(stock.dias_para_repor),
      );

      const existsNotification = await getDb().notificacao.findFirst({
        where: {
          tipo_evento: NotificationEventType.REPOSICAO_ESTOQUE,
          medicamento_id: stock.medicamento_id,
          residente_id: stock.casela_id,
          data_prevista: nextReposition,
        },
      });

      if (existsNotification) continue;

      if (stockTenantId == null) {
        throw new Error('Tenant não identificado no registro de estoque');
      }
      await getDb().notificacao.create({
        data: {
          tenant_id: stockTenantId,
          tipo_evento: NotificationEventType.REPOSICAO_ESTOQUE,
          destino: NotificationDestinoType.ESTOQUE,
          medicamento_id: stock.medicamento_id,
          residente_id: stock.casela_id,
          data_prevista: nextReposition,
          criado_por: 1,
          visto: false,
          status: EventStatus.PENDENTE,
          quantidade: stock.quantidade,
          dias_para_repor: stock.dias_para_repor,
        },
      });

      created++;
    }

    return created;
  }

  async update(
    tenantId: number,
    id: number,
    updates: NotificationUpdateData,
    transaction?: Prisma.TransactionClient,
  ) {
    const event = await db(transaction).notificacao.findFirst({
      where: { tenant_id: tenantId, id },
    });
    if (!event) return null;

    const updateData: Prisma.NotificacaoUpdateInput = {};

    if (updates.visto !== undefined) updateData.visto = updates.visto;
    if (updates.data_prevista !== undefined)
      updateData.data_prevista = updates.data_prevista;
    if (updates.destino !== undefined) updateData.destino = updates.destino;

    if (updates.status !== undefined) {
      const statusMap: Record<string, EventStatus> = {
        pending: EventStatus.PENDENTE,
        sent: EventStatus.ENVIADO,
        completed: EventStatus.ENVIADO,
        cancelled: EventStatus.CANCELADO,
      };
      const key = String(updates.status);
      updateData.status = statusMap[key] ?? updates.status;
    }

    const res = await db(transaction).notificacao.updateMany({
      where: { tenant_id: tenantId, id },
      data: updateData,
    });
    if (res.count === 0) return null;
    return this.findById(tenantId, id, transaction);
  }

  async delete(
    tenantId: number,
    id: number,
    transaction?: Prisma.TransactionClient,
  ) {
    const res = await db(transaction).notificacao.deleteMany({
      where: { tenant_id: tenantId, id },
    });
    return res.count > 0;
  }
}
