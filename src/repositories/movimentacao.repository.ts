import type { MovementRecord } from '@porto-sdk/sdk';

export type MovementCreateInput = MovementRecord & {
  sector_id?: number | null;
};
import { Prisma } from '@prisma/client';
import type { Movimentacao } from '@prisma/client';
import { formatDateToPtBr } from '@helpers/date.helper';
import { NonMovementedItem, OperationType } from '@helpers/utils';
import { getDb } from '@repositories/prisma';
import type { MovementQueryParams } from '@domain/movimentacao.types';

function db(tx?: Prisma.TransactionClient) {
  return tx ?? getDb();
}

function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfMonth(d: Date) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1);
  x.setDate(0);
  x.setHours(23, 59, 59, 999);
  return x;
}

function buildDrawerPlain(
  gaveta: { num_gaveta: number; categoria_id: number } | null | undefined,
  categoria: { nome: string } | null | undefined,
) {
  if (!gaveta) return null;
  return {
    num_gaveta: gaveta.num_gaveta,
    DrawerCategoryModel: categoria ? { nome: categoria.nome } : undefined,
  };
}

async function loadMovementRelationMaps(
  rows: Movimentacao[],
  options: { includeDrawer: boolean },
  tx?: Prisma.TransactionClient,
) {
  const client = db(tx);
  const medIds = [
    ...new Set(
      rows.map(r => r.medicamento_id).filter((x): x is number => x != null),
    ),
  ];
  const insIds = [
    ...new Set(
      rows.map(r => r.insumo_id).filter((x): x is number => x != null),
    ),
  ];
  const loginIds = [...new Set(rows.map(r => r.login_id))];

  const armarioOr: Prisma.ArmarioWhereInput[] = [];
  const seenArm = new Set<string>();
  for (const r of rows) {
    if (r.armario_id == null) continue;
    const k = `${r.tenant_id}:${r.armario_id}`;
    if (seenArm.has(k)) continue;
    seenArm.add(k);
    armarioOr.push({ tenant_id: r.tenant_id, num_armario: r.armario_id });
  }

  const residentOr: Prisma.ResidenteWhereInput[] = [];
  const seenRes = new Set<string>();
  for (const r of rows) {
    if (r.casela_id == null) continue;
    const k = `${r.tenant_id}:${r.casela_id}`;
    if (seenRes.has(k)) continue;
    seenRes.add(k);
    residentOr.push({ tenant_id: r.tenant_id, num_casela: r.casela_id });
  }

  const gavetaOr: Prisma.GavetaWhereInput[] = [];
  const seenGav = new Set<string>();
  if (options.includeDrawer) {
    for (const r of rows) {
      if (r.gaveta_id == null) continue;
      const k = `${r.tenant_id}:${r.gaveta_id}`;
      if (seenGav.has(k)) continue;
      seenGav.add(k);
      gavetaOr.push({ tenant_id: r.tenant_id, num_gaveta: r.gaveta_id });
    }
  }

  const [meds, ins, logins, armarios, residentes, gavetas] = await Promise.all([
    medIds.length
      ? client.medicamento.findMany({
          where: { id: { in: medIds } },
          select: { id: true, nome: true, principio_ativo: true },
        })
      : Promise.resolve([]),
    insIds.length
      ? client.insumo.findMany({
          where: { id: { in: insIds } },
          select: { id: true, nome: true, descricao: true },
        })
      : Promise.resolve([]),
    loginIds.length
      ? client.login.findMany({
          where: { id: { in: loginIds } },
          select: { id: true, login: true, first_name: true },
        })
      : Promise.resolve([]),
    armarioOr.length
      ? client.armario.findMany({
          where: { OR: armarioOr },
          select: { tenant_id: true, num_armario: true },
        })
      : Promise.resolve([]),
    residentOr.length
      ? client.residente.findMany({
          where: { OR: residentOr },
          select: { tenant_id: true, num_casela: true, nome: true },
        })
      : Promise.resolve([]),
    options.includeDrawer && gavetaOr.length
      ? client.gaveta.findMany({
          where: { OR: gavetaOr },
          select: {
            tenant_id: true,
            num_gaveta: true,
            categoria_id: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const medMap = new Map(meds.map(m => [m.id, m]));
  const insMap = new Map(ins.map(i => [i.id, i]));
  const loginMap = new Map(logins.map(l => [l.id, l]));
  const armarioMap = new Map(
    armarios.map(a => [`${a.tenant_id}:${a.num_armario}`, a]),
  );
  const resMap = new Map(
    residentes.map(res => [`${res.tenant_id}:${res.num_casela}`, res]),
  );

  const catIds = [...new Set(gavetas.map(g => g.categoria_id).filter(Boolean))];
  const cats = catIds.length
    ? await client.categoriaGaveta.findMany({
        where: { id: { in: catIds } },
        select: { id: true, nome: true },
      })
    : [];
  const catMap = new Map(cats.map(c => [c.id, c]));
  const gavetaMap = new Map(
    gavetas.map(g => {
      const cat = catMap.get(g.categoria_id);
      return [
        `${g.tenant_id}:${g.num_gaveta}`,
        { gaveta: g, categoria: cat ?? null },
      ];
    }),
  );

  return { medMap, insMap, loginMap, armarioMap, resMap, gavetaMap };
}

function toMovementPlain(
  m: Movimentacao,
  maps: Awaited<ReturnType<typeof loadMovementRelationMaps>>,
  options: { includeDrawer: boolean },
) {
  const med =
    m.medicamento_id != null ? maps.medMap.get(m.medicamento_id) : undefined;
  const ins = m.insumo_id != null ? maps.insMap.get(m.insumo_id) : undefined;
  const login = maps.loginMap.get(m.login_id);
  const arm =
    m.armario_id != null
      ? maps.armarioMap.get(`${m.tenant_id}:${m.armario_id}`)
      : undefined;
  const res =
    m.casela_id != null
      ? maps.resMap.get(`${m.tenant_id}:${m.casela_id}`)
      : undefined;
  let drawerPlain: ReturnType<typeof buildDrawerPlain> = null;
  if (options.includeDrawer && m.gaveta_id != null) {
    const g = maps.gavetaMap.get(`${m.tenant_id}:${m.gaveta_id}`);
    drawerPlain = buildDrawerPlain(g?.gaveta ?? null, g?.categoria ?? null);
  }

  return {
    ...m,
    MedicineModel: med
      ? {
          id: med.id,
          nome: med.nome,
          principio_ativo: med.principio_ativo,
        }
      : null,
    InputModel: ins
      ? {
          id: ins.id,
          nome: ins.nome,
          descricao: ins.descricao,
        }
      : null,
    LoginModel: login
      ? {
          id: login.id,
          login: login.login,
          first_name: login.first_name,
        }
      : null,
    CabinetModel: arm ? { num_armario: arm.num_armario } : null,
    ResidentModel: res ? { num_casela: res.num_casela, nome: res.nome } : null,
    DrawerModel: drawerPlain,
  };
}

export class PrismaMovementRepository {
  async countMovementsThisMonth(): Promise<number> {
    const now = new Date();
    return db().movimentacao.count({
      where: {
        data: { gte: startOfMonth(now), lte: endOfMonth(now) },
      },
    });
  }

  async listMovementsThisMonth(page: number = 1, limit: number = 25) {
    const now = new Date();
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
    const offset = (safePage - 1) * safeLimit;
    const range = { gte: startOfMonth(now), lte: endOfMonth(now) };

    const [rows, count] = await Promise.all([
      db().movimentacao.findMany({
        where: { data: range },
        orderBy: { data: 'desc' },
        skip: offset,
        take: safeLimit,
      }),
      db().movimentacao.count({ where: { data: range } }),
    ]);

    const maps = await loadMovementRelationMaps(rows, { includeDrawer: false });

    const data = rows.map(r => {
      const plain = toMovementPlain(r, maps, { includeDrawer: false }) as {
        id: number;
        tipo: string;
        data: Date;
        quantidade: number;
        setor: string;
        lote: string | null;
        medicamento_id?: number | null;
        MedicineModel?: { nome?: string } | null;
        InputModel?: { nome?: string } | null;
        LoginModel?: { first_name?: string | null; login?: string } | null;
        ResidentModel?: { nome?: string } | null;
      };
      return {
        id: plain.id,
        tipo: plain.tipo,
        data: formatDateToPtBr(plain.data),
        quantidade: plain.quantidade,
        setor: plain.setor,
        lote: plain.lote,
        nome: plain.MedicineModel?.nome ?? plain.InputModel?.nome ?? '-',
        operador:
          plain.LoginModel?.first_name ?? plain.LoginModel?.login ?? '-',
        armario_id: r.armario_id,
        casela_id: r.casela_id,
        residente: plain.ResidentModel?.nome ?? null,
        item_type: plain.medicamento_id ? 'medicamento' : 'insumo',
      };
    });

    return {
      data,
      total: count,
      hasNext: count > safePage * safeLimit,
      page: safePage,
      limit: safeLimit,
    };
  }

  async create(
    data: MovementCreateInput,
    transaction?: Prisma.TransactionClient,
  ) {
    const r = data as MovementCreateInput & {
      destino?: string | null;
      lote?: string | null;
      observacao?: string | null;
    };
    const sectorIdMov = r.sector_id;
    return db(transaction).movimentacao.create({
      data: {
        tenant_id: Number(r.tenant_id) || 1,
        tipo: String(r.tipo),
        login_id: Number(r.login_id),
        insumo_id: r.insumo_id != null ? Number(r.insumo_id) : null,
        medicamento_id:
          r.medicamento_id != null ? Number(r.medicamento_id) : null,
        armario_id: r.armario_id != null ? Number(r.armario_id) : null,
        gaveta_id: r.gaveta_id != null ? Number(r.gaveta_id) : null,
        quantidade: Number(r.quantidade),
        casela_id: r.casela_id != null ? Number(r.casela_id) : null,
        setor: String(r.setor),
        sector_id: sectorIdMov != null ? Number(sectorIdMov) : null,
        destino: r.destino != null ? String(r.destino) : null,
        lote: r.lote != null ? String(r.lote) : null,
        observacao: r.observacao != null ? String(r.observacao) : null,
        data: new Date(),
      },
    });
  }

  async listMedicineMovements({
    tenantId,
    days,
    type,
    page,
    limit,
  }: MovementQueryParams) {
    const where: Prisma.MovimentacaoWhereInput = {
      tenant_id: tenantId,
      medicamento_id: { not: null },
    };

    if (days && days > 0) {
      where.data = { gte: new Date(Date.now() - days * 86400000) };
    }

    if (type) where.tipo = type;

    const offset = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      db().movimentacao.findMany({
        where,
        orderBy: { data: 'desc' },
        skip: offset,
        take: limit,
      }),
      db().movimentacao.count({ where }),
    ]);

    const maps = await loadMovementRelationMaps(rows, { includeDrawer: true });

    const formatted = rows.map(r => {
      const plain = toMovementPlain(r, maps, { includeDrawer: true });
      return {
        ...plain,
        data: formatDateToPtBr(r.data),
      };
    });

    return {
      data: formatted,
      hasNext: count > page * limit,
      total: count,
      page,
      limit,
    };
  }

  async listPharmacyToNursingTransfers({
    tenantId,
    startDate,
    endDate,
    page,
    limit,
  }: {
    tenantId: number;
    startDate?: Date;
    endDate?: Date;
    page: number;
    limit: number;
  }) {
    const where: Prisma.MovimentacaoWhereInput = {
      tenant_id: tenantId,
      medicamento_id: { not: null },
      setor: 'farmacia',
      tipo: OperationType.INDIVIDUAL,
    };

    const offset = (page - 1) * limit;

    if (startDate && endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      where.data = { gte: startDate, lte: endOfDay };
    } else if (startDate) {
      where.data = { gte: startDate };
    } else if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      where.data = { lte: endOfDay };
    }

    const [rows, count] = await Promise.all([
      db().movimentacao.findMany({
        where,
        orderBy: { data: 'desc' },
        skip: offset,
        take: limit,
      }),
      db().movimentacao.count({ where }),
    ]);

    const maps = await loadMovementRelationMaps(rows, { includeDrawer: false });

    const pairs = rows
      .filter(r => r.medicamento_id != null && r.casela_id != null)
      .map(r => ({
        medicamento_id: r.medicamento_id as number,
        casela_id: r.casela_id as number,
      }));

    const uniquePairs = Array.from(
      new Map(
        pairs.map(p => [`${p.medicamento_id}-${p.casela_id}`, p]),
      ).values(),
    );

    let nursingStockMap: Map<string, boolean> = new Map();
    if (uniquePairs.length > 0) {
      const nursingStocks = await db().estoqueMedicamento.findMany({
        where: {
          setor: 'enfermagem',
          OR: uniquePairs.map(p => ({
            medicamento_id: p.medicamento_id,
            casela_id: p.casela_id,
          })),
        },
        select: { medicamento_id: true, casela_id: true },
      });
      nursingStockMap = new Map(
        nursingStocks.map(s => [`${s.medicamento_id}-${s.casela_id}`, true]),
      );
    }

    const transfers = rows
      .map(row => {
        const movement = toMovementPlain(row, maps, {
          includeDrawer: false,
        });
        if (
          row.medicamento_id &&
          row.casela_id &&
          nursingStockMap.get(`${row.medicamento_id}-${row.casela_id}`)
        ) {
          return { ...movement, data: formatDateToPtBr(row.data) };
        }
        return null;
      })
      .filter((t): t is NonNullable<typeof t> => t != null);

    return {
      data: transfers,
      hasNext: count > page * limit,
      total: transfers.length,
      page,
      limit,
    };
  }

  async listInputMovements({
    tenantId,
    days,
    type,
    page,
    limit,
  }: MovementQueryParams) {
    const where: Prisma.MovimentacaoWhereInput = {
      tenant_id: tenantId,
      insumo_id: { not: null },
    };

    if (days && days > 0) {
      where.data = { gte: new Date(Date.now() - days * 86400000) };
    }

    if (type) {
      where.tipo = type;
    }

    const offset = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      db().movimentacao.findMany({
        where,
        orderBy: { data: 'desc' },
        skip: offset,
        take: limit,
      }),
      db().movimentacao.count({ where }),
    ]);

    const maps = await loadMovementRelationMaps(rows, { includeDrawer: true });

    const formatted = rows.map(r => {
      const plain = toMovementPlain(r, maps, { includeDrawer: true });
      return {
        ...plain,
        data: formatDateToPtBr(r.data),
      };
    });

    return {
      data: formatted,
      hasNext: count > page * limit,
      total: count,
      page,
      limit,
    };
  }

  async getMedicineRanking({
    tenantId,
    type,
    page,
    limit,
  }: {
    tenantId: number;
    type?: string;
    page: number;
    limit: number;
  }) {
    const offset = (page - 1) * limit;
    const orderDirection = type === 'less' ? 'ASC' : 'DESC';

    type RankRow = {
      medicamento_id: number;
      total_entradas: number;
      total_saidas: number;
      qtd_entradas: number;
      qtd_saidas: number;
      total_movimentado: number;
      med_id: number | null;
      med_nome: string | null;
      med_principio_ativo: string | null;
    };

    const result = await db().$queryRaw<RankRow[]>(Prisma.sql`
      SELECT
        m.medicamento_id,
        COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade ELSE 0 END), 0)::integer AS total_entradas,
        COALESCE(SUM(CASE WHEN m.tipo = 'saida' THEN m.quantidade ELSE 0 END), 0)::integer AS total_saidas,
        COUNT(CASE WHEN m.tipo = 'entrada' THEN 1 END)::integer AS qtd_entradas,
        COUNT(CASE WHEN m.tipo = 'saida' THEN 1 END)::integer AS qtd_saidas,
        COALESCE(SUM(m.quantidade), 0)::integer AS total_movimentado,
        med.id AS med_id,
        med.nome AS med_nome,
        med.principio_ativo AS med_principio_ativo
      FROM movimentacao m
      LEFT JOIN medicamento med ON med.id = m.medicamento_id
      WHERE m.tenant_id = ${tenantId} AND m.medicamento_id IS NOT NULL
      GROUP BY m.medicamento_id, med.id, med.nome, med.principio_ativo
      ORDER BY total_movimentado ${Prisma.raw(orderDirection)}
      LIMIT ${limit} OFFSET ${offset}
    `);

    const totalRows = await db().$queryRaw<[{ c: bigint }]>(Prisma.sql`
      SELECT COUNT(DISTINCT medicamento_id)::bigint AS c
      FROM movimentacao
      WHERE tenant_id = ${tenantId} AND medicamento_id IS NOT NULL
    `);
    const totalCount = Number(totalRows[0].c);

    const data = result.map(row => {
      const medicamento =
        row.med_id != null
          ? {
              id: row.med_id,
              nome: row.med_nome ?? '',
              principio_ativo: row.med_principio_ativo ?? '',
            }
          : null;

      return {
        medicamento_id: Number(row.medicamento_id) || 0,
        total_entradas: Number(row.total_entradas) || 0,
        total_saidas: Number(row.total_saidas) || 0,
        qtd_entradas: Number(row.qtd_entradas) || 0,
        qtd_saidas: Number(row.qtd_saidas) || 0,
        total_movimentado: Number(row.total_movimentado) || 0,
        medicamento,
      };
    });

    return {
      data,
      hasNext: totalCount > page * limit,
      total: totalCount,
      page,
      limit,
    };
  }

  async getNonMovementedMedicines(tenantId: number, limit = 10) {
    type NonMovementedRawRow = {
      id: number;
      nome: string;
      detalhe: string | null;
      ultima_movimentacao: Date | null;
      dias_parados: number | null;
    };

    const medicines = await db().$queryRaw<NonMovementedRawRow[]>(Prisma.sql`
      SELECT
        m.id,
        m.nome,
        m.principio_ativo AS detalhe,
        MAX(mov.data) AS ultima_movimentacao,
        DATE_PART('day', NOW() - MAX(mov.data)) AS dias_parados
      FROM medicamento m
      INNER JOIN estoque_medicamento em
        ON em.medicamento_id = m.id AND em.tenant_id = ${tenantId} AND em.quantidade > 0
      LEFT JOIN movimentacao mov ON mov.medicamento_id = m.id AND mov.tenant_id = ${tenantId}
      WHERE m.tenant_id = ${tenantId}
      GROUP BY m.id, m.nome, m.principio_ativo
      ORDER BY dias_parados DESC NULLS LAST
      LIMIT ${limit}
    `);

    const inputs = await db().$queryRaw<NonMovementedRawRow[]>(Prisma.sql`
      SELECT
        i.id,
        i.nome,
        i.descricao AS detalhe,
        MAX(mov.data) AS ultima_movimentacao,
        DATE_PART('day', NOW() - MAX(mov.data)) AS dias_parados
      FROM insumo i
      INNER JOIN estoque_insumo ei ON ei.insumo_id = i.id AND ei.tenant_id = ${tenantId} AND ei.quantidade > 0
      LEFT JOIN movimentacao mov ON mov.insumo_id = i.id AND mov.tenant_id = ${tenantId}
      WHERE i.tenant_id = ${tenantId}
      GROUP BY i.id, i.nome, i.descricao
      ORDER BY dias_parados DESC NULLS LAST
      LIMIT ${limit}
    `);

    const results: NonMovementedItem[] = [
      ...medicines.map(m => ({
        item_id: m.id,
        nome: m.nome,
        detalhe: m.detalhe ?? null,
        ultima_movimentacao: formatDateToPtBr(
          m.ultima_movimentacao ?? new Date('1900-01-01'),
        ),
        dias_parados: Number(m.dias_parados ?? 0),
      })),
      ...inputs.map(i => ({
        item_id: i.id,
        nome: i.nome,
        detalhe: i.detalhe ?? null,
        ultima_movimentacao: formatDateToPtBr(
          i.ultima_movimentacao ?? new Date('1900-01-01'),
        ),
        dias_parados: Number(i.dias_parados ?? 0),
      })),
    ];

    results.sort((a, b) => b.dias_parados - a.dias_parados);

    return results.slice(0, limit);
  }

  async getConsumptionByPeriod(
    tenantId: number,
    startDate: Date,
    endDate: Date,
    groupBy: 'month' | 'quarter',
    transaction?: Prisma.TransactionClient,
  ): Promise<{ period: string; entrada: number; saida: number }[]> {
    const trunc = groupBy === 'quarter' ? 'quarter' : 'month';
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    type ConsumptionRow = {
      period: Date;
      entrada: number;
      saida: number;
    };

    const rows = await db(transaction).$queryRaw<ConsumptionRow[]>(Prisma.sql`
      SELECT
        date_trunc(${Prisma.raw(`'${trunc}'`)}, "data")::date AS period,
        COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN quantidade ELSE 0 END), 0)::integer AS entrada,
        COALESCE(SUM(CASE WHEN tipo = 'saida' THEN quantidade ELSE 0 END), 0)::integer AS saida
      FROM movimentacao
      WHERE tenant_id = ${tenantId} AND "data" >= ${startDate} AND "data" <= ${endOfDay}
      GROUP BY date_trunc(${Prisma.raw(`'${trunc}'`)}, "data")
      ORDER BY period ASC
    `);

    return rows.map(r => ({
      period: r.period ? formatDateToPtBr(r.period) : '',
      entrada: Number(r.entrada) || 0,
      saida: Number(r.saida) || 0,
    }));
  }

  async getConsumptionByItem(
    tenantId: number,
    startDate: Date,
    endDate: Date,
    transaction?: Prisma.TransactionClient,
  ): Promise<{
    items: {
      tipo_item: 'medicamento' | 'insumo';
      item_id: number;
      nome: string;
      entrada: number;
      saida: number;
    }[];
    subtotal: { entrada: number; saida: number };
  }> {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    type Row = {
      tipo_item: string;
      item_id: number;
      nome: string;
      entrada: number;
      saida: number;
    };

    const rows = await db(transaction).$queryRaw<Row[]>(Prisma.sql`
      SELECT * FROM (
        SELECT
          'medicamento'::text AS tipo_item,
          m.id AS item_id,
          m.nome,
          COALESCE(SUM(CASE WHEN mov.tipo = 'entrada' THEN mov.quantidade ELSE 0 END), 0)::integer AS entrada,
          COALESCE(SUM(CASE WHEN mov.tipo = 'saida' THEN mov.quantidade ELSE 0 END), 0)::integer AS saida
        FROM movimentacao mov
        JOIN medicamento m ON mov.medicamento_id = m.id
        WHERE mov.tenant_id = ${tenantId} AND mov.data >= ${startDate} AND mov.data <= ${endOfDay} AND mov.medicamento_id IS NOT NULL
        GROUP BY m.id, m.nome
        UNION ALL
        SELECT
          'insumo'::text,
          i.id,
          i.nome,
          COALESCE(SUM(CASE WHEN mov.tipo = 'entrada' THEN mov.quantidade ELSE 0 END), 0)::integer,
          COALESCE(SUM(CASE WHEN mov.tipo = 'saida' THEN mov.quantidade ELSE 0 END), 0)::integer
        FROM movimentacao mov
        JOIN insumo i ON mov.insumo_id = i.id
        WHERE mov.tenant_id = ${tenantId} AND mov.data >= ${startDate} AND mov.data <= ${endOfDay} AND mov.insumo_id IS NOT NULL
        GROUP BY i.id, i.nome
      ) AS u
      ORDER BY tipo_item, nome
    `);

    const items = rows.map((r: Row) => ({
      tipo_item:
        r.tipo_item === 'insumo'
          ? ('insumo' as const)
          : ('medicamento' as const),
      item_id: Number(r.item_id) || 0,
      nome: String(r.nome ?? ''),
      entrada: Number(r.entrada) || 0,
      saida: Number(r.saida) || 0,
    }));

    const subtotal = items.reduce(
      (
        acc: { entrada: number; saida: number },
        row: (typeof items)[number],
      ) => ({
        entrada: acc.entrada + row.entrada,
        saida: acc.saida + row.saida,
      }),
      { entrada: 0, saida: 0 },
    );

    return { items, subtotal };
  }

  async listHistoryByItemId(
    itemType: 'medicamento' | 'insumo',
    itemId: number,
    page: number = 1,
    limit: number = 50,
    transaction?: Prisma.TransactionClient,
  ) {
    const isMed = itemType === 'medicamento';
    const where: Prisma.MovimentacaoWhereInput = isMed
      ? { medicamento_id: itemId }
      : { insumo_id: itemId };

    const offset = (page - 1) * limit;
    const [rows, count] = await Promise.all([
      db(transaction).movimentacao.findMany({
        where,
        orderBy: { data: 'desc' },
        skip: offset,
        take: limit,
      }),
      db(transaction).movimentacao.count({ where }),
    ]);

    const maps = await loadMovementRelationMaps(
      rows,
      { includeDrawer: false },
      transaction,
    );

    const data = rows.map(r => {
      const plain = toMovementPlain(r, maps, { includeDrawer: false }) as {
        id: number;
        tipo: string;
        data: Date;
        quantidade: number;
        setor: string;
        lote: string | null;
        MedicineModel?: { nome?: string } | null;
        InputModel?: { nome?: string } | null;
        LoginModel?: { first_name?: string | null; login?: string } | null;
        ResidentModel?: { nome?: string } | null;
      };
      return {
        id: plain.id,
        tipo: plain.tipo,
        data: formatDateToPtBr(plain.data),
        quantidade: plain.quantidade,
        setor: plain.setor,
        lote: plain.lote,
        nome: plain.MedicineModel?.nome ?? plain.InputModel?.nome ?? '-',
        operador:
          plain.LoginModel?.first_name ?? plain.LoginModel?.login ?? '-',
        armario_id: r.armario_id,
        casela_id: r.casela_id,
        residente: plain.ResidentModel?.nome ?? null,
      };
    });

    return { data, total: count, hasNext: count > page * limit, page, limit };
  }

  async listHistoryByLote(
    lote: string,
    page: number = 1,
    limit: number = 50,
    transaction?: Prisma.TransactionClient,
  ) {
    if (!lote || String(lote).trim() === '') {
      return { data: [], total: 0, hasNext: false, page: 1, limit };
    }
    const trimmed = String(lote).trim();
    const where: Prisma.MovimentacaoWhereInput = {
      lote: { contains: trimmed, mode: 'insensitive' },
    };
    const offset = (page - 1) * limit;
    const [rows, count] = await Promise.all([
      db(transaction).movimentacao.findMany({
        where,
        orderBy: { data: 'desc' },
        skip: offset,
        take: limit,
      }),
      db(transaction).movimentacao.count({ where }),
    ]);

    const maps = await loadMovementRelationMaps(
      rows,
      { includeDrawer: false },
      transaction,
    );

    const data = rows.map(r => {
      const plain = toMovementPlain(r, maps, { includeDrawer: false }) as {
        id: number;
        tipo: string;
        data: Date;
        quantidade: number;
        setor: string;
        lote: string | null;
        medicamento_id?: number | null;
        MedicineModel?: { nome?: string } | null;
        InputModel?: { nome?: string } | null;
        LoginModel?: { first_name?: string | null; login?: string } | null;
        ResidentModel?: { nome?: string } | null;
      };
      return {
        id: plain.id,
        tipo: plain.tipo,
        data: formatDateToPtBr(plain.data),
        quantidade: plain.quantidade,
        setor: plain.setor,
        lote: plain.lote,
        nome: plain.MedicineModel?.nome ?? plain.InputModel?.nome ?? '-',
        operador:
          plain.LoginModel?.first_name ?? plain.LoginModel?.login ?? '-',
        armario_id: r.armario_id,
        casela_id: r.casela_id,
        residente: plain.ResidentModel?.nome ?? null,
        item_type: plain.medicamento_id ? 'medicamento' : 'insumo',
      };
    });

    return { data, total: count, hasNext: count > page * limit, page, limit };
  }
}
