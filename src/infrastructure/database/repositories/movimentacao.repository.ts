import { Op, fn, col, QueryTypes } from 'sequelize';
import type { Transaction } from 'sequelize';
import MovementModel from '../models/movimentacao.model';
import Movement from '../../../core/domain/movimentacao';
import MedicineModel from '../models/medicamento.model';
import MedicineStockModel from '../models/estoque-medicamento.model';
import InputStockModel from '../models/estoque-insumo.model';
import CabinetModel from '../models/armario.model';
import ResidenteModel from '../models/residente.model';
import LoginModel from '../models/login.model';
import InputModel from '../models/insumo.model';
import { formatDateToPtBr } from '../../helpers/date.helper';
import { sequelize } from '../sequelize';
import { NonMovementedItem, OperationType } from '../../../core/utils/utils';
import { MovementWhereOptions } from '../../types/sequelize.types';

export interface MovementQueryParams {
  days?: number;
  page: number;
  limit: number;
  type?: string;
}

export class MovementRepository {
  async create(data: Movement, transaction?: Transaction) {
    return await MovementModel.create(
      {
        ...data,
        data: new Date(),
      },
      { transaction },
    );
  }

  async listMedicineMovements({
    days,
    type,
    page,
    limit,
  }: MovementQueryParams) {
    const where: MovementWhereOptions = {
      medicamento_id: { [Op.not]: null },
    };

    if (days && days > 0) {
      where.data = { [Op.gte]: new Date(Date.now() - days * 86400000) };
    }

    if (type) where.tipo = type;

    const offset = (page - 1) * limit;

    const { rows, count } = await MovementModel.findAndCountAll({
      where,
      order: [['data', 'DESC']],
      offset,
      limit,
      include: [
        { model: MedicineModel, attributes: ['nome', 'principio_ativo'] },
        { model: CabinetModel, attributes: ['num_armario'] },
        { model: ResidenteModel, attributes: ['num_casela', 'nome'] },
        { model: LoginModel, attributes: ['first_name'] },
      ],
    });

    const formatted = rows.map(r => ({
      ...r.get({ plain: true }),
      data: formatDateToPtBr(r.data),
    }));

    return {
      data: formatted,
      hasNext: count > page * limit,
      total: count,
      page,
      limit,
    };
  }

  async listPharmacyToNursingTransfers({
    startDate,
    endDate,
    page,
    limit,
  }: {
    startDate?: Date;
    endDate?: Date;
    page: number;
    limit: number;
  }) {
    const where: MovementWhereOptions = {
      medicamento_id: { [Op.not]: null },
      setor: 'farmacia',
      tipo: OperationType.INDIVIDUAL,
    };

    const offset = (page - 1) * limit;

    if (startDate && endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      where.data = {
        [Op.between]: [startDate, endOfDay],
      };
    } else if (startDate) {
      where.data = { [Op.gte]: startDate };
    } else if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      where.data = { [Op.lte]: endOfDay };
    }

    const { rows, count } = await MovementModel.findAndCountAll({
      where,
      order: [['data', 'DESC']],
      offset,
      limit,
      include: [
        { model: MedicineModel, attributes: ['id', 'nome', 'principio_ativo'] },
        { model: CabinetModel, attributes: ['num_armario'] },
        { model: ResidenteModel, attributes: ['num_casela', 'nome'] },
        { model: LoginModel, attributes: ['login'] },
      ],
    });

    const transfers = [];
    for (const row of rows) {
      const movement = row.get({ plain: true });

      if (movement.medicamento_id && movement.casela_id) {
        const stockInNursing = await MedicineStockModel.findOne({
          where: {
            medicamento_id: movement.medicamento_id,
            casela_id: movement.casela_id,
            setor: 'enfermagem',
          },
        });

        if (stockInNursing) {
          transfers.push({
            ...movement,
            data: formatDateToPtBr(movement.data),
          });
        }
      }
    }

    return {
      data: transfers,
      hasNext: count > page * limit,
      total: transfers.length,
      page,
      limit,
    };
  }

  async listInputMovements({ days, type, page, limit }: MovementQueryParams) {
    const where: MovementWhereOptions = {
      insumo_id: { [Op.not]: null },
    };

    if (days && days > 0) {
      where.data = { [Op.gte]: new Date(Date.now() - days * 86400000) };
    }

    if (type) {
      where.tipo = type;
    }

    const offset = (page - 1) * limit;

    const { rows, count } = await MovementModel.findAndCountAll({
      where,
      order: [['data', 'DESC']],
      offset,
      limit,
      include: [
        { model: InputModel, attributes: ['nome', 'descricao'] },
        { model: CabinetModel, attributes: ['num_armario'] },
        { model: ResidenteModel, attributes: ['num_casela', 'nome'] },
        { model: LoginModel, attributes: ['first_name'] },
      ],
    });

    const formatted = rows.map(r => ({
      ...r.get({ plain: true }),
      data: formatDateToPtBr(r.data),
    }));

    return {
      data: formatted,
      hasNext: count > page * limit,
      total: count,
      page,
      limit,
    };
  }

  async getMedicineRanking({
    type,
    page,
    limit,
  }: {
    type?: string;
    page: number;
    limit: number;
  }) {
    const offset = (page - 1) * limit;
    const orderDirection = type === 'less' ? 'ASC' : 'DESC';

    const result = await MovementModel.findAll({
      where: { medicamento_id: { [Op.not]: null } },

      attributes: [
        'medicamento_id',
        [
          sequelize.literal(
            `SUM(CASE WHEN "MovementModel"."tipo" = 'entrada' THEN "MovementModel"."quantidade" ELSE 0 END)`,
          ),
          'total_entradas',
        ],
        [
          sequelize.literal(
            `SUM(CASE WHEN "MovementModel"."tipo" = 'saida' THEN "MovementModel"."quantidade" ELSE 0 END)`,
          ),
          'total_saidas',
        ],
        [
          sequelize.literal(
            `COUNT(CASE WHEN "MovementModel"."tipo" = 'entrada' THEN 1 END)`,
          ),
          'qtd_entradas',
        ],
        [
          sequelize.literal(
            `COUNT(CASE WHEN "MovementModel"."tipo" = 'saida' THEN 1 END)`,
          ),
          'qtd_saidas',
        ],
        [
          sequelize.literal(`SUM("MovementModel"."quantidade")`),
          'total_movimentado',
        ],
      ],

      include: [
        {
          model: MedicineModel,
          attributes: ['id', 'nome', 'principio_ativo'],
          required: false,
        },
      ],

      group: [
        'medicamento_id',
        'MedicineModel.id',
        'MedicineModel.nome',
        'MedicineModel.principio_ativo',
      ],

      order: [[sequelize.literal('"total_movimentado"'), orderDirection]],
      limit,
      offset,
      subQuery: false,
    });

    const totalCount = await MovementModel.count({
      where: { medicamento_id: { [Op.not]: null } },
      distinct: true,
      col: 'medicamento_id',
    });

    const data = result.map(r => {
      const row =
        r && typeof r === 'object' && 'get' in r && typeof r.get === 'function'
          ? (
              r as {
                get: (options: { plain: true }) => Record<string, unknown>;
              }
            ).get({ plain: true })
          : (r as unknown as Record<string, unknown>);

      const medicamento = row.MedicineModel
        ? {
            id: (row.MedicineModel as { id: number }).id,
            nome: (row.MedicineModel as { nome: string }).nome,
            principio_ativo: (row.MedicineModel as { principio_ativo: string })
              .principio_ativo,
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

  async getNonMovementedMedicines(limit = 10) {
    const medicines = await MedicineModel.findAll({
      attributes: [
        'id',
        'nome',
        ['principio_ativo', 'detalhe'],
        [
          sequelize.fn('MAX', sequelize.col('MovementModels.data')),
          'ultima_movimentacao',
        ],
        [
          sequelize.literal(
            `DATE_PART('day', NOW() - MAX("MovementModels"."data"))`,
          ),
          'dias_parados',
        ],
      ],
      include: [
        {
          model: MovementModel,
          attributes: [],
          required: false,
        },
        {
          model: MedicineStockModel,
          attributes: [],
          where: {
            quantidade: { [Op.gt]: 0 },
          },
          required: true,
        },
      ],
      group: ['MedicineModel.id'],
      order: [[sequelize.literal('dias_parados'), 'DESC']],
      limit,
      subQuery: false,
      raw: true,
    });

    const inputs = await InputModel.findAll({
      attributes: [
        'id',
        'nome',
        ['descricao', 'detalhe'],
        [
          sequelize.fn('MAX', sequelize.col('MovementModels.data')),
          'ultima_movimentacao',
        ],
        [
          sequelize.literal(
            `DATE_PART('day', NOW() - MAX("MovementModels"."data"))`,
          ),
          'dias_parados',
        ],
      ],
      include: [
        {
          model: MovementModel,
          attributes: [],
          required: false,
        },
        {
          model: InputStockModel,
          attributes: [],
          where: {
            quantidade: { [Op.gt]: 0 },
          },
          required: true,
        },
      ],
      group: ['InputModel.id'],
      order: [[sequelize.literal('dias_parados'), 'DESC']],
      limit,
      subQuery: false,
      raw: true,
    });

    const results: NonMovementedItem[] = [
      ...medicines.map((m: any) => ({
        item_id: m.id,
        nome: m.nome,
        detalhe: m.detalhe,
        ultima_movimentacao: formatDateToPtBr(
          m.ultima_movimentacao ?? new Date('1900-01-01'),
        ),
        dias_parados: Number(m.dias_parados ?? 0),
      })),
      ...inputs.map((i: any) => ({
        item_id: i.id,
        nome: i.nome,
        detalhe: i.detalhe || null,
        ultima_movimentacao: formatDateToPtBr(
          i.ultima_movimentacao ?? new Date('1900-01-01'),
        ),
        dias_parados: Number(i.dias_parados ?? 0),
      })),
    ];

    results.sort((a, b) => b.dias_parados - a.dias_parados);

    return results.slice(0, limit);
  }

  /** Consumption (entrada/saida) aggregated by period (month or quarter). */
  async getConsumptionByPeriod(
    startDate: Date,
    endDate: Date,
    groupBy: 'month' | 'quarter',
    transaction?: Transaction,
  ): Promise<{ period: string; entrada: number; saida: number }[]> {
    const trunc = groupBy === 'quarter' ? 'quarter' : 'month';
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    const table = '"movimentacao"';
    const dataCol = '"data"';
    const periodExpr = `date_trunc('${trunc}', ${dataCol})`;

    type ConsumptionRow = {
      period: string | Date;
      entrada: number;
      saida: number;
    };
    const rows = await sequelize.query<ConsumptionRow>(
      `
      SELECT
        ${periodExpr}::date AS period,
        COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN quantidade ELSE 0 END), 0)::integer AS entrada,
        COALESCE(SUM(CASE WHEN tipo = 'saida' THEN quantidade ELSE 0 END), 0)::integer AS saida
      FROM ${table}
      WHERE ${dataCol} >= :startDate AND ${dataCol} <= :endDate
      GROUP BY ${periodExpr}
      ORDER BY period ASC
      `,
      {
        replacements: { startDate, endDate: endOfDay },
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    const result = rows.map(r => ({
      period: r.period ? formatDateToPtBr(r.period) : '',
      entrada: Number(r.entrada) || 0,
      saida: Number(r.saida) || 0,
    }));
    return result;
  }

  async getConsumptionByItem(
    startDate: Date,
    endDate: Date,
    transaction?: Transaction,
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
    const rows = await sequelize.query<Row>(
      `
      SELECT * FROM (
        SELECT
          'medicamento'::text AS tipo_item,
          m.id AS item_id,
          m.nome,
          COALESCE(SUM(CASE WHEN mov.tipo = 'entrada' THEN mov.quantidade ELSE 0 END), 0)::integer AS entrada,
          COALESCE(SUM(CASE WHEN mov.tipo = 'saida' THEN mov.quantidade ELSE 0 END), 0)::integer AS saida
        FROM movimentacao mov
        JOIN medicamento m ON mov.medicamento_id = m.id
        WHERE mov.data >= :startDate AND mov.data <= :endDate AND mov.medicamento_id IS NOT NULL
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
        WHERE mov.data >= :startDate AND mov.data <= :endDate AND mov.insumo_id IS NOT NULL
        GROUP BY i.id, i.nome
      ) AS u
      ORDER BY tipo_item, nome
      `,
      {
        replacements: { startDate, endDate: endOfDay },
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    const items = rows.map(r => ({
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
      (acc, row) => ({
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
    transaction?: Transaction,
  ) {
    const isMed = itemType === 'medicamento';
    const where: MovementWhereOptions = isMed
      ? { medicamento_id: itemId }
      : { insumo_id: itemId };

    const offset = (page - 1) * limit;
    const { rows, count } = await MovementModel.findAndCountAll({
      where,
      order: [['data', 'DESC']],
      offset,
      limit,
      include: [
        isMed
          ? {
              model: MedicineModel,
              as: 'MedicineModel',
              attributes: ['id', 'nome', 'principio_ativo'],
            }
          : {
              model: InputModel,
              as: 'InputModel',
              attributes: ['id', 'nome', 'descricao'],
            },
        {
          model: LoginModel,
          as: 'LoginModel',
          attributes: ['id', 'login', 'first_name'],
        },
        {
          model: CabinetModel,
          as: 'CabinetModel',
          attributes: ['num_armario'],
        },
        {
          model: ResidenteModel,
          as: 'ResidentModel',
          attributes: ['num_casela', 'nome'],
        },
      ],
      transaction,
    });

    const data = rows.map(r => {
      const plain = r.get({ plain: true }) as any;
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
        armario_id: plain.armario_id,
        casela_id: plain.casela_id,
        residente: plain.ResidentModel?.nome ?? null,
      };
    });

    return { data, total: count, hasNext: count > page * limit, page, limit };
  }

  /** List movements by lote for admin audit. */
  async listHistoryByLote(
    lote: string,
    page: number = 1,
    limit: number = 50,
    transaction?: Transaction,
  ) {
    if (!lote || String(lote).trim() === '') {
      return { data: [], total: 0, hasNext: false, page: 1, limit };
    }
    const where: MovementWhereOptions = {
      lote: { [Op.iLike]: `%${String(lote).trim()}%` },
    };
    const offset = (page - 1) * limit;
    const { rows, count } = await MovementModel.findAndCountAll({
      where,
      order: [['data', 'DESC']],
      offset,
      limit,
      include: [
        {
          model: MedicineModel,
          as: 'MedicineModel',
          attributes: ['id', 'nome', 'principio_ativo'],
          required: false,
        },
        {
          model: InputModel,
          as: 'InputModel',
          attributes: ['id', 'nome', 'descricao'],
          required: false,
        },
        {
          model: LoginModel,
          as: 'LoginModel',
          attributes: ['id', 'login', 'first_name'],
        },
        {
          model: CabinetModel,
          as: 'CabinetModel',
          attributes: ['num_armario'],
        },
        {
          model: ResidenteModel,
          as: 'ResidentModel',
          attributes: ['num_casela', 'nome'],
        },
      ],
      transaction,
    });

    const data = rows.map(r => {
      const plain = r.get({ plain: true }) as any;
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
        armario_id: plain.armario_id,
        casela_id: plain.casela_id,
        residente: plain.ResidentModel?.nome ?? null,
        item_type: plain.medicamento_id ? 'medicamento' : 'insumo',
      };
    });

    return { data, total: count, hasNext: count > page * limit, page, limit };
  }
}
