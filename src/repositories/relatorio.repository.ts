import { Prisma } from '@prisma/client';
import type { Movimentacao } from '@prisma/client';
import { getDb } from '@repositories/prisma';
import {
  AllItemsReport,
  ExpiredMedicineReport,
  ExpiringSoonReport,
  InputReport,
  MedicineReport,
  MovementReport,
  PsicotropicosReport,
  ResidentReport,
  ResidentConsumptionInput,
  ResidentConsumptionMedicine,
  ResidentConsumptionReport,
  ResidentMedicinesReport,
  TransferReport,
} from '@domain/relatorio.types';
import { ResidentMonthlyUsage, MovementType } from '@helpers/utils';
import {
  formatDateToPtBr,
  formatDateTimeToPtBr,
} from '@helpers/date.helper';
import {
  formatMedicineName,
  formatCurrency,
} from '@helpers/format.helper';
import { MovementsParams, MovementPeriod } from '@services/relatorio.service';

function db(tx?: Prisma.TransactionClient) {
  return tx ?? getDb();
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'number') return v;
  return Number(v);
}

function decimalToNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  return parseFloat(String(v));
}

type MedRow = {
  id: number;
  nome: string;
  dosagem: string;
  unidade_medida: string;
  principio_ativo: string;
  preco: Prisma.Decimal | null;
};

type InsRow = {
  id: number;
  nome: string;
  descricao: string | null;
  preco: Prisma.Decimal | null;
};

async function loadReportMovementMaps(
  rows: Movimentacao[],
  tx?: Prisma.TransactionClient,
) {
  const client = db(tx);
  const medIds = [
    ...new Set(
      rows.map(r => r.medicamento_id).filter((x): x is number => x != null),
    ),
  ];
  const insIds = [
    ...new Set(rows.map(r => r.insumo_id).filter((x): x is number => x != null)),
  ];
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

  const [meds, ins, armarios, residentes] = await Promise.all([
    medIds.length
      ? client.medicamento.findMany({
          where: { id: { in: medIds } },
          select: {
            id: true,
            nome: true,
            principio_ativo: true,
            dosagem: true,
            unidade_medida: true,
          },
        })
      : Promise.resolve([]),
    insIds.length
      ? client.insumo.findMany({
          where: { id: { in: insIds } },
          select: { id: true, nome: true, descricao: true },
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
  ]);

  const medMap = new Map(meds.map(m => [m.id, m]));
  const insMap = new Map(ins.map(i => [i.id, i]));
  const armarioMap = new Map(
    armarios.map(a => [`${a.tenant_id}:${a.num_armario}`, a]),
  );
  const resMap = new Map(
    residentes.map(res => [`${res.tenant_id}:${res.num_casela}`, res]),
  );

  return { medMap, insMap, armarioMap, resMap };
}

function toMovementPlain(
  m: Movimentacao,
  maps: Awaited<ReturnType<typeof loadReportMovementMaps>>,
) {
  const med = m.medicamento_id != null ? maps.medMap.get(m.medicamento_id) : undefined;
  const ins = m.insumo_id != null ? maps.insMap.get(m.insumo_id) : undefined;
  const arm =
    m.armario_id != null
      ? maps.armarioMap.get(`${m.tenant_id}:${m.armario_id}`)
      : undefined;
  const res =
    m.casela_id != null
      ? maps.resMap.get(`${m.tenant_id}:${m.casela_id}`)
      : undefined;

  return {
    ...m,
    MedicineModel: med
      ? {
          nome: med.nome,
          principio_ativo: med.principio_ativo,
          dosagem: med.dosagem,
          unidade_medida: med.unidade_medida,
        }
      : undefined,
    InputModel: ins
      ? { nome: ins.nome, descricao: ins.descricao }
      : undefined,
    ResidentModel: res
      ? { num_casela: res.num_casela, nome: res.nome }
      : undefined,
    CabinetModel: arm ? { num_armario: arm.num_armario } : undefined,
  };
}

interface MovementPlain {
  data?: Date;
  createdAt?: Date;
  tipo?: string;
  quantidade?: number;
  lote?: string | null;
  destino?: string | null;
  observacao?: string | null;
  setor?: string;
  gaveta_id?: number | null;
  MedicineModel?: {
    nome?: string;
    principio_ativo?: string;
    dosagem?: string;
    unidade_medida?: string;
  };
  InputModel?: { nome?: string; descricao?: string | null };
  ResidentModel?: { nome?: string; num_casela?: number };
  CabinetModel?: { num_armario?: number };
}

export class PrismaReportRepository {
  async getMedicinesData(): Promise<MedicineReport[]> {
    const rows = await db().$queryRaw<
      {
        medicamento: string;
        principio_ativo: string;
        validade: Date;
        quantidade: bigint | number;
        residente: string | null;
      }[]
    >(Prisma.sql`
      SELECT
        m.nome AS medicamento,
        m.principio_ativo AS principio_ativo,
        em.validade AS validade,
        SUM(em.quantidade)::int AS quantidade,
        r.nome AS residente
      FROM estoque_medicamento em
      INNER JOIN medicamento m ON m.id = em.medicamento_id
      LEFT JOIN residente r ON r.tenant_id = em.tenant_id AND r.num_casela = em.casela_id
      GROUP BY m.nome, m.principio_ativo, em.validade, r.nome
      ORDER BY m.nome ASC, em.validade ASC
    `);

    return rows.map(row => ({
      medicamento: row.medicamento || '',
      principio_ativo: row.principio_ativo || '',
      validade: row.validade != null ? String(row.validade) : '',
      quantidade: toNum(row.quantidade),
      residente: row.residente,
    }));
  }

  async getInputsData(): Promise<InputReport[]> {
    const rows = await db().$queryRaw<
      {
        insumo: string;
        validade: Date;
        armario: number | null;
        quantidade: bigint | number;
        residente: string | null;
      }[]
    >(Prisma.sql`
      SELECT
        i.nome AS insumo,
        ei.validade AS validade,
        ei.armario_id AS armario,
        SUM(ei.quantidade)::int AS quantidade,
        r.nome AS residente
      FROM estoque_insumo ei
      INNER JOIN insumo i ON i.id = ei.insumo_id
      LEFT JOIN residente r ON r.tenant_id = ei.tenant_id AND r.num_casela = ei.casela_id
      GROUP BY i.nome, ei.validade, ei.armario_id, r.nome
      ORDER BY i.nome ASC, ei.validade ASC
    `);

    return rows.map(row => ({
      insumo: row.insumo || '',
      validade: row.validade != null ? new Date(row.validade) : new Date(),
      quantidade: toNum(row.quantidade),
      armario: row.armario ?? 0,
      residente: row.residente,
    }));
  }

  async getResidentsData(): Promise<ResidentReport[]> {
    const rows = await db().$queryRaw<
      {
        residente: string;
        casela: number;
        medicamento: string;
        principio_ativo: string | null;
        quantidade: bigint | number;
        validade: Date;
      }[]
    >(Prisma.sql`
      SELECT
        r.nome AS residente,
        r.num_casela AS casela,
        m.nome AS medicamento,
        m.principio_ativo AS principio_ativo,
        SUM(em.quantidade)::int AS quantidade,
        MIN(em.validade) AS validade
      FROM estoque_medicamento em
      INNER JOIN medicamento m ON m.id = em.medicamento_id
      INNER JOIN residente r ON r.tenant_id = em.tenant_id AND r.num_casela = em.casela_id
      WHERE em.casela_id IS NOT NULL
      GROUP BY r.nome, r.num_casela, m.nome, m.principio_ativo
      ORDER BY r.nome ASC, m.nome ASC
    `);

    return rows.map(row => ({
      residente: row.residente || '',
      casela: row.casela ?? 0,
      medicamento: row.medicamento || '',
      principio_ativo: row.principio_ativo,
      quantidade: toNum(row.quantidade),
      validade: new Date(row.validade),
    }));
  }

  async getResidentsMonthlyUsage(): Promise<ResidentMonthlyUsage[]> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const rows = await db().$queryRaw<
      {
        residente: string;
        casela: number;
        medicamento: string;
        principio_ativo: string;
        data: Date;
        consumo_mensal: bigint | number;
      }[]
    >(Prisma.sql`
      SELECT
        r.nome AS residente,
        r.num_casela AS casela,
        m.nome AS medicamento,
        m.principio_ativo AS principio_ativo,
        DATE_TRUNC('month', mov.data)::date AS data,
        SUM(mov.quantidade)::int AS consumo_mensal
      FROM movimentacao mov
      INNER JOIN medicamento m ON m.id = mov.medicamento_id
      INNER JOIN residente r ON r.tenant_id = mov.tenant_id AND r.num_casela = mov.casela_id
      WHERE mov.tipo = ${MovementType.SAIDA}
        AND mov.medicamento_id IS NOT NULL
        AND mov.casela_id IS NOT NULL
        AND mov.data >= ${startOfMonth}
        AND mov.data < ${startOfNextMonth}
      GROUP BY r.num_casela, r.nome, m.id, m.nome, m.principio_ativo, DATE_TRUNC('month', mov.data)
      ORDER BY r.nome ASC, m.nome ASC
    `);

    return rows.map(row => ({
      residente: row.residente || '',
      casela: row.casela ?? 0,
      medicamento: row.medicamento || '',
      principio_ativo: row.principio_ativo || '',
      data: new Date(row.data),
      consumo_mensal: toNum(row.consumo_mensal),
    }));
  }

  async getPsicotropicosData(): Promise<PsicotropicosReport> {
    const rows = await db().$queryRaw<
      {
        tipo: string;
        data: Date;
        quantidade: number;
        med_nome: string | null;
        res_nome: string | null;
      }[]
    >(Prisma.sql`
      SELECT
        mov.tipo,
        mov.data,
        mov.quantidade,
        med.nome AS med_nome,
        res.nome AS res_nome
      FROM movimentacao mov
      INNER JOIN medicamento med ON med.id = mov.medicamento_id
      LEFT JOIN residente res ON res.tenant_id = mov.tenant_id AND res.num_casela = mov.casela_id
      INNER JOIN armario a ON a.tenant_id = mov.tenant_id AND a.num_armario = mov.armario_id
      WHERE mov.medicamento_id IS NOT NULL
        AND a.categoria_id = 2
      ORDER BY mov.data ASC
    `);

    const formatted = rows.map(row => ({
      tipo: row.tipo as MovementType,
      medicamento: row.med_nome || '',
      residente: row.res_nome || '',
      data_movimentacao: formatDateToPtBr(row.data),
      quantidade: toNum(row.quantidade),
    }));

    return { psicotropico: formatted };
  }

  async getAllItemsData(): Promise<AllItemsReport> {
    const [medicines, inputs] = await Promise.all([
      db().$queryRaw<
        {
          medicamento: string;
          principio_ativo: string;
          quantidade: bigint | number;
          validade: Date | null;
          residente: string | null;
        }[]
      >(Prisma.sql`
        SELECT
          m.nome AS medicamento,
          m.principio_ativo AS principio_ativo,
          SUM(em.quantidade)::int AS quantidade,
          MIN(em.validade) AS validade,
          r.nome AS residente
        FROM estoque_medicamento em
        INNER JOIN medicamento m ON m.id = em.medicamento_id
        LEFT JOIN residente r ON r.tenant_id = em.tenant_id AND r.num_casela = em.casela_id
        GROUP BY m.nome, m.principio_ativo, r.nome
        ORDER BY m.nome ASC
      `),
      db().$queryRaw<
        {
          insumo: string;
          quantidade: bigint | number;
          armario: number | null;
          validade: Date | null;
          residente: string | null;
        }[]
      >(Prisma.sql`
        SELECT
          i.nome AS insumo,
          SUM(ei.quantidade)::int AS quantidade,
          ei.armario_id AS armario,
          MIN(ei.validade) AS validade,
          r.nome AS residente
        FROM estoque_insumo ei
        INNER JOIN insumo i ON i.id = ei.insumo_id
        LEFT JOIN residente r ON r.tenant_id = ei.tenant_id AND r.num_casela = ei.casela_id
        GROUP BY i.nome, ei.armario_id, r.nome
        ORDER BY i.nome ASC
      `),
    ]);

    return {
      medicamentos: medicines.map(row => ({
        medicamento: row.medicamento || '',
        principio_ativo: row.principio_ativo || '',
        quantidade: toNum(row.quantidade),
        validade: row.validade != null ? String(row.validade) : '',
        residente: row.residente,
      })),
      insumos: inputs.map(row => ({
        insumo: row.insumo || '',
        quantidade: toNum(row.quantidade),
        armario: row.armario ?? 0,
        validade: row.validade ? new Date(row.validade) : new Date(),
        residente: row.residente,
      })),
    };
  }

  async getResidentConsumptionReport(
    casela: number,
  ): Promise<ResidentConsumptionReport | null> {
    const resident = await db().residente.findFirst({
      where: { num_casela: casela },
    });
    if (!resident) {
      return null;
    }

    const [medicinesRows, inputsRows] = await Promise.all([
      db().$queryRaw<
        (MedRow & {
          quantidade_estoque: bigint | number;
          observacao: string | null;
        })[]
      >(Prisma.sql`
        SELECT
          m.id,
          m.nome,
          m.dosagem,
          m.unidade_medida,
          m.principio_ativo,
          m.preco,
          COALESCE(SUM(em.quantidade), 0)::int AS quantidade_estoque,
          STRING_AGG(DISTINCT em.observacao, '; ')
            FILTER (WHERE em.observacao IS NOT NULL AND em.observacao <> '') AS observacao
        FROM estoque_medicamento em
        INNER JOIN medicamento m ON m.id = em.medicamento_id
        WHERE em.casela_id = ${casela}
        GROUP BY m.id, m.nome, m.dosagem, m.unidade_medida, m.principio_ativo, m.preco
        ORDER BY m.nome ASC
      `),
      db().$queryRaw<
        (InsRow & { quantidade_estoque: bigint | number })[]
      >(Prisma.sql`
        SELECT
          i.id,
          i.nome,
          i.descricao,
          i.preco,
          COALESCE(SUM(ei.quantidade), 0)::int AS quantidade_estoque
        FROM estoque_insumo ei
        INNER JOIN insumo i ON i.id = ei.insumo_id
        WHERE ei.casela_id = ${casela}
        GROUP BY i.id, i.nome, i.descricao, i.preco
        ORDER BY i.nome ASC
      `),
    ]);

    const medicines: ResidentConsumptionMedicine[] = medicinesRows.map(row => {
      const nome = row.nome || '';
      const dosagem = row.dosagem || '';
      const unidadeMedida = row.unidade_medida || '';
      const preco = decimalToNumber(row.preco);

      return {
        nome: formatMedicineName(nome, dosagem, unidadeMedida),
        principio_ativo: row.principio_ativo || '',
        preco_formatado: formatCurrency(preco),
        quantidade_estoque: toNum(row.quantidade_estoque),
        observacao: row.observacao || null,
      };
    });

    const inputs: ResidentConsumptionInput[] = inputsRows.map(row => {
      const preco = decimalToNumber(row.preco);

      return {
        nome: row.nome || '',
        descricao: row.descricao,
        preco_formatado: formatCurrency(preco),
        quantidade_estoque: toNum(row.quantidade_estoque),
      };
    });

    const custosMedicamentos = medicinesRows.map(row => {
      const nome = row.nome || '';
      const dosagem = row.dosagem || '';
      const unidadeMedida = row.unidade_medida || '';
      const preco = decimalToNumber(row.preco) ?? 0;
      const custoMensal = preco;
      const custoAnual = custoMensal * 12;

      return {
        item: 'Medicamento',
        nome: formatMedicineName(nome, dosagem, unidadeMedida),
        custo_mensal: Math.round(custoMensal * 100) / 100,
        custo_anual: Math.round(custoAnual * 100) / 100,
        custo_mensal_formatado: formatCurrency(custoMensal),
        custo_anual_formatado: formatCurrency(custoAnual),
      };
    });

    const custosInsumos = inputsRows.map(row => {
      const preco = decimalToNumber(row.preco) ?? 0;
      const custoMensal = preco;
      const custoAnual = custoMensal * 12;

      return {
        item: 'Insumo',
        nome: row.nome || '',
        custo_mensal: Math.round(custoMensal * 100) / 100,
        custo_anual: Math.round(custoAnual * 100) / 100,
        custo_mensal_formatado: formatCurrency(custoMensal),
        custo_anual_formatado: formatCurrency(custoAnual),
      };
    });

    const totalEstimado =
      medicinesRows.reduce((sum, row) => {
        const preco = decimalToNumber(row.preco) ?? 0;
        return sum + preco * 12;
      }, 0) +
      inputsRows.reduce((sum, row) => {
        const preco = decimalToNumber(row.preco) ?? 0;
        return sum + preco * 12;
      }, 0);

    return {
      residente: resident.nome,
      casela: resident.num_casela,
      medicamentos: medicines,
      insumos: inputs,
      custos_medicamentos: custosMedicamentos,
      custos_insumos: custosInsumos,
      total_estimado_formatado: formatCurrency(totalEstimado),
    };
  }

  async getTransfersData(date: string): Promise<TransferReport[]> {
    if (!date) {
      throw new Error('Data é obrigatória para relatório de transferências');
    }

    const d = new Date(date);
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      23,
      59,
      59,
      999,
    );

    const results = await db().movimentacao.findMany({
      where: {
        tipo: MovementType.TRANSFERENCIA,
        setor: 'enfermagem',
        data: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { data: 'desc' },
    });

    const maps = await loadReportMovementMaps(results);

    return results.map(row => {
      const plain = toMovementPlain(row, maps) as MovementPlain;

      let nomeCompleto = '';
      if (plain.MedicineModel) {
        const nome = plain.MedicineModel.nome || '';
        const dosagem = plain.MedicineModel.dosagem || '';
        const unidadeMedida = plain.MedicineModel.unidade_medida || '';
        nomeCompleto =
          [nome, dosagem, unidadeMedida].filter(Boolean).join(' ').trim() ||
          nome;
      } else if (plain.InputModel) {
        nomeCompleto = plain.InputModel.nome || '';
      }

      return {
        data: formatDateToPtBr(plain.data),
        nome: nomeCompleto,
        principio_ativo: plain.MedicineModel?.principio_ativo || null,
        descricao: plain.InputModel?.descricao || null,
        quantidade: Number(plain.quantidade) || 0,
        casela: plain.ResidentModel?.num_casela ?? null,
        residente: plain.ResidentModel?.nome || null,
        armario: plain.CabinetModel?.num_armario ?? null,
        lote: plain.lote || null,
        destino: plain.destino || null,
        observacao: plain.observacao || null,
      };
    });
  }

  async getTransfersDataByInterval(
    data_inicial: string,
    data_final: string,
  ): Promise<TransferReport[]> {
    const start = new Date(data_inicial);
    start.setHours(0, 0, 0, 0);

    const end = new Date(data_final);
    end.setHours(23, 59, 59, 999);

    const results = await db().movimentacao.findMany({
      where: {
        tipo: MovementType.TRANSFERENCIA,
        setor: 'enfermagem',
        data: { gte: start, lte: end },
      },
      orderBy: { data: 'desc' },
    });

    const maps = await loadReportMovementMaps(results);

    return results.map(row => {
      const plain = toMovementPlain(row, maps) as MovementPlain;

      let nomeCompleto = '';
      if (plain.MedicineModel) {
        const nome = plain.MedicineModel.nome || '';
        const dosagem = plain.MedicineModel.dosagem || '';
        const unidadeMedida = plain.MedicineModel.unidade_medida || '';
        nomeCompleto =
          [nome, dosagem, unidadeMedida].filter(Boolean).join(' ').trim() ||
          nome;
      } else if (plain.InputModel) {
        nomeCompleto = plain.InputModel.nome || '';
      }

      return {
        data: formatDateToPtBr(plain.data),
        nome: nomeCompleto,
        principio_ativo: plain.MedicineModel?.principio_ativo || null,
        descricao: plain.InputModel?.descricao || null,
        quantidade: Number(plain.quantidade) || 0,
        casela: plain.ResidentModel?.num_casela ?? null,
        residente: plain.ResidentModel?.nome || null,
        armario: plain.CabinetModel?.num_armario ?? null,
        lote: plain.lote || null,
        destino: plain.destino || null,
        observacao: plain.observacao || null,
      };
    });
  }

  async getMovementsByPeriod(
    params: MovementsParams,
  ): Promise<MovementReport[]> {
    let start: Date;
    let end: Date;

    switch (params.periodo) {
      case MovementPeriod.DIARIO: {
        const d = new Date(params.data);
        start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        end = new Date(
          d.getFullYear(),
          d.getMonth(),
          d.getDate(),
          23,
          59,
          59,
          999,
        );
        break;
      }

      case MovementPeriod.MENSAL: {
        const [year, month] = params.mes.split('-').map(Number);
        start = new Date(year, month - 1, 1);
        end = new Date(year, month, 0, 23, 59, 59, 999);
        break;
      }

      case MovementPeriod.INTERVALO: {
        start = new Date(params.data_inicial);
        end = new Date(params.data_final);
        end.setHours(23, 59, 59, 999);
        break;
      }

      default:
        throw new Error('Período inválido');
    }

    const results = await db().movimentacao.findMany({
      where: {
        data: { gte: start, lte: end },
      },
      orderBy: { data: 'desc' },
    });

    const maps = await loadReportMovementMaps(results);

    return results.map(row => {
      const plain = toMovementPlain(row, maps) as MovementPlain;
      const dateTime = plain.createdAt || plain.data;
      const tipo = plain.tipo as
        | 'entrada'
        | 'saida'
        | 'transferencia'
        | undefined;
      const tipoMov =
        tipo === 'entrada' || tipo === 'saida' || tipo === 'transferencia'
          ? tipo
          : 'saida';

      return {
        data: formatDateTimeToPtBr(dateTime),
        tipo_movimentacao: tipoMov,
        nome: plain.MedicineModel?.nome || plain.InputModel?.nome || '',
        principio_ativo: plain.MedicineModel?.principio_ativo || null,
        descricao: plain.InputModel?.descricao || null,
        quantidade: Number(plain.quantidade) || 0,
        casela: plain.ResidentModel?.num_casela ?? null,
        residente: plain.ResidentModel?.nome || null,
        armario: plain.CabinetModel?.num_armario ?? null,
        gaveta: plain.gaveta_id ?? null,
        setor: plain.setor ?? '',
        lote: plain.lote || null,
        destino: plain.destino || null,
        observacao: plain.observacao || null,
      };
    });
  }

  async getResidentMedicinesData(
    casela: number,
  ): Promise<ResidentMedicinesReport[]> {
    const resident = await db().residente.findFirst({
      where: { num_casela: casela },
    });

    if (!resident) {
      return [];
    }

    const rows = await db().$queryRaw<
      {
        residente: string;
        num_casela: number;
        nome: string;
        dosagem: string;
        unidade_medida: string;
        principio_ativo: string;
        quantidade: bigint | number;
        validade: Date;
      }[]
    >(Prisma.sql`
      SELECT
        r.nome AS residente,
        r.num_casela AS num_casela,
        m.nome AS nome,
        m.dosagem AS dosagem,
        m.unidade_medida AS unidade_medida,
        m.principio_ativo AS principio_ativo,
        SUM(em.quantidade)::int AS quantidade,
        MIN(em.validade) AS validade
      FROM estoque_medicamento em
      INNER JOIN medicamento m ON m.id = em.medicamento_id
      INNER JOIN residente r ON r.tenant_id = em.tenant_id AND r.num_casela = em.casela_id
      WHERE em.casela_id IS NOT NULL
        AND r.num_casela = ${casela}
      GROUP BY r.nome, r.num_casela, m.nome, m.principio_ativo, m.dosagem, m.unidade_medida
      ORDER BY m.nome ASC
    `);

    return rows.map(row => {
      const nome = row.nome || '';
      const dosagem = row.dosagem || '';
      const unidadeMedida = row.unidade_medida || '';

      return {
        residente: row.residente || '',
        casela: row.num_casela ?? casela,
        medicamento: formatMedicineName(nome, dosagem, unidadeMedida),
        principio_ativo: row.principio_ativo ?? '',
        quantidade: toNum(row.quantidade),
        validade: formatDateToPtBr(new Date(row.validade)),
      };
    });
  }

  async getExpiredMedicinesData(): Promise<ExpiredMedicineReport[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = await db().$queryRaw<
      {
        medicamento: string;
        principio_ativo: string;
        quantidade: bigint | number;
        validade: Date;
        residente: string | null;
        lote: string | null;
        setor: string;
      }[]
    >(Prisma.sql`
      SELECT
        m.nome AS medicamento,
        m.principio_ativo AS principio_ativo,
        SUM(em.quantidade)::int AS quantidade,
        em.validade AS validade,
        r.nome AS residente,
        em.lote AS lote,
        em.setor AS setor
      FROM estoque_medicamento em
      INNER JOIN medicamento m ON m.id = em.medicamento_id
      LEFT JOIN residente r ON r.tenant_id = em.tenant_id AND r.num_casela = em.casela_id
      WHERE em.validade < ${today}
      GROUP BY m.nome, m.principio_ativo, em.validade, em.lote, em.setor, r.nome
      ORDER BY em.validade ASC, m.nome ASC
    `);

    return rows.map(row => {
      const expiryDate = new Date(row.validade);
      const daysExpired = Math.floor(
        (today.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        medicamento: row.medicamento || '',
        principio_ativo: row.principio_ativo || '',
        quantidade: toNum(row.quantidade),
        validade: formatDateToPtBr(expiryDate),
        residente: row.residente,
        dias_vencido: daysExpired,
        lote: row.lote,
        setor: row.setor || '',
      };
    });
  }

  async getExpiringSoonData(): Promise<ExpiringSoonReport[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in45Days = new Date(today);
    in45Days.setDate(today.getDate() + 45);

    const results: ExpiringSoonReport[] = [];

    const medicines = await db().$queryRaw<
      {
        nome: string;
        principio_ativo: string;
        quantidade: bigint | number;
        validade: Date;
        residente: string | null;
        lote: string | null;
        setor: string;
        armario: number | null;
        gaveta: number | null;
      }[]
    >(Prisma.sql`
      SELECT
        m.nome AS nome,
        m.principio_ativo AS principio_ativo,
        SUM(em.quantidade)::int AS quantidade,
        em.validade AS validade,
        r.nome AS residente,
        em.lote AS lote,
        em.setor AS setor,
        em.armario_id AS armario,
        em.gaveta_id AS gaveta
      FROM estoque_medicamento em
      INNER JOIN medicamento m ON m.id = em.medicamento_id
      LEFT JOIN residente r ON r.tenant_id = em.tenant_id AND r.num_casela = em.casela_id
      WHERE em.validade >= ${today}
        AND em.validade <= ${in45Days}
        AND em.quantidade > 0
      GROUP BY m.nome, m.principio_ativo, em.validade, em.lote, em.setor, em.armario_id, em.gaveta_id, r.nome
      ORDER BY em.validade ASC, m.nome ASC
    `);

    for (const row of medicines) {
      const expiryDate = new Date(row.validade);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      results.push({
        tipo: 'medicamento',
        nome: row.nome || '',
        principio_ativo: row.principio_ativo || null,
        quantidade: toNum(row.quantidade),
        validade: formatDateToPtBr(expiryDate),
        dias_para_vencer: daysUntilExpiry,
        residente: row.residente,
        lote: row.lote,
        setor: row.setor || '',
        armario: row.armario,
        gaveta: row.gaveta,
      });
    }

    const inputs = await db().$queryRaw<
      {
        nome: string;
        descricao: string | null;
        quantidade: bigint | number;
        validade: Date;
        residente: string | null;
        lote: string | null;
        setor: string;
        armario: number | null;
        gaveta: number | null;
      }[]
    >(Prisma.sql`
      SELECT
        i.nome AS nome,
        i.descricao AS descricao,
        SUM(ei.quantidade)::int AS quantidade,
        ei.validade AS validade,
        r.nome AS residente,
        ei.lote AS lote,
        ei.setor AS setor,
        ei.armario_id AS armario,
        ei.gaveta_id AS gaveta
      FROM estoque_insumo ei
      INNER JOIN insumo i ON i.id = ei.insumo_id
      LEFT JOIN residente r ON r.tenant_id = ei.tenant_id AND r.num_casela = ei.casela_id
      WHERE ei.validade >= ${today}
        AND ei.validade <= ${in45Days}
        AND ei.quantidade > 0
      GROUP BY i.nome, i.descricao, ei.validade, ei.lote, ei.setor, ei.armario_id, ei.gaveta_id, r.nome
      ORDER BY ei.validade ASC, i.nome ASC
    `);

    for (const row of inputs) {
      const expiryDate = new Date(row.validade);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      results.push({
        tipo: 'insumo',
        nome: row.nome || '',
        descricao: row.descricao,
        quantidade: toNum(row.quantidade),
        validade: formatDateToPtBr(expiryDate),
        dias_para_vencer: daysUntilExpiry,
        residente: row.residente,
        lote: row.lote,
        setor: row.setor || '',
        armario: row.armario,
        gaveta: row.gaveta,
      });
    }

    return results.sort((a, b) => a.dias_para_vencer - b.dias_para_vencer);
  }
}
