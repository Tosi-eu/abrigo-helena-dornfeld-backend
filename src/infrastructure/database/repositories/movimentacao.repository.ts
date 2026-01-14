import { Op, WhereOptions } from 'sequelize';
import MovementModel from '../models/movimentacao.model';
import Movement from '../../../core/domain/movimentacao';
import MedicineModel from '../models/medicamento.model';
import MedicineStockModel from '../models/estoque-medicamento.model';
import CabinetModel from '../models/armario.model';
import ResidenteModel from '../models/residente.model';
import LoginModel from '../models/login.model';
import InputModel from '../models/insumo.model';
import { formatDateToPtBr } from '../../helpers/date.helper';
import { sequelize } from '../sequelize';
import { NonMovementedItem, ItemType, OperationType } from '../../../core/utils/utils';
import { MovementWhereOptions } from '../../types/sequelize.types';

export interface MovementQueryParams {
  days?: number;
  page: number;
  limit: number;
  type?: string;
}

export class MovementRepository {
  async create(data: Movement) {
    return await MovementModel.create({
      ...data,
      data: new Date(),
    });
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
        { model: LoginModel, attributes: ['login'] },
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
        { model: LoginModel, attributes: ['login'] },
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
    const now = new Date();
    const results: NonMovementedItem[] = [];

    const medicineMovements = await MovementModel.findAll({
      attributes: [
        'medicamento_id',
        [
          sequelize.literal('MAX("MovementModel"."data")'),
          'ultima_movimentacao',
        ],
      ],
      where: {
        medicamento_id: { [Op.not]: null },
      },
      include: [
        {
          model: MedicineModel,
          attributes: ['id', 'nome', 'principio_ativo'],
          required: true,
        },
      ],
      group: [
        'medicamento_id',
        'MedicineModel.id',
        'MedicineModel.nome',
        'MedicineModel.principio_ativo',
      ],
      raw: false,
      subQuery: false,
    });

    for (const movement of medicineMovements) {
      const plain = movement.get({ plain: true }) as any;
      const medicine = plain.MedicineModel;
      const ultimaMovimentacao = plain.ultima_movimentacao
        ? new Date(plain.ultima_movimentacao)
        : new Date('1900-01-01');
      const diasParados = Math.floor(
        (now.getTime() - ultimaMovimentacao.getTime()) / (1000 * 60 * 60 * 24),
      );

      results.push({
        tipo_item: ItemType.MEDICAMENTO,
        item_id: medicine.id,
        nome: medicine.nome,
        detalhe: medicine.principio_ativo,
        ultima_movimentacao: formatDateToPtBr(ultimaMovimentacao),
        dias_parados: diasParados,
      });
    }

    const inputMovements = await MovementModel.findAll({
      attributes: [
        'insumo_id',
        [
          sequelize.literal('MAX("MovementModel"."data")'),
          'ultima_movimentacao',
        ],
      ],
      where: {
        insumo_id: { [Op.not]: null },
      },
      include: [
        {
          model: InputModel,
          attributes: ['id', 'nome', 'descricao'],
          required: true,
        },
      ],
      group: [
        'insumo_id',
        'InputModel.id',
        'InputModel.nome',
        'InputModel.descricao',
      ],
      raw: false,
      subQuery: false,
    });

    for (const movement of inputMovements) {
      const plain = movement.get({ plain: true }) as any;
      const input = plain.InputModel;
      const ultimaMovimentacao = plain.ultima_movimentacao
        ? new Date(plain.ultima_movimentacao)
        : new Date('1900-01-01');
      const diasParados = Math.floor(
        (now.getTime() - ultimaMovimentacao.getTime()) / (1000 * 60 * 60 * 24),
      );

      results.push({
        tipo_item: ItemType.INSUMO,
        item_id: input.id,
        nome: input.nome,
        detalhe: input.descricao || null,
        ultima_movimentacao: formatDateToPtBr(ultimaMovimentacao),
        dias_parados: diasParados,
      });
    }

    results.sort((a, b) => b.dias_parados - a.dias_parados);
    return results.slice(0, limit);
  }
}
