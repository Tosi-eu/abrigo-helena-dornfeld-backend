import { sequelize } from '../sequelize';
import { Op, fn, col, where } from 'sequelize';
import {
  AllItemsReport,
  InputReport,
  MedicineReport,
  PsicotropicosReport,
  ResidentConsumptionReport,
  ResidentConsumptionMedicine,
  ResidentConsumptionInput,
  ResidentReport,
  TransferReport,
  MovementReport,
  ResidentMedicinesReport,
  ExpiredMedicineReport,
} from '../models/relatorio.model';
import { ResidentMonthlyUsage, MovementType } from '../../../core/utils/utils';
import { formatDateToPtBr } from '../../helpers/date.helper';
import MedicineStockModel from '../models/estoque-medicamento.model';
import InputStockModel from '../models/estoque-insumo.model';
import MedicineModel from '../models/medicamento.model';
import InputModel from '../models/insumo.model';
import ResidentModel from '../models/residente.model';
import MovementModel from '../models/movimentacao.model';
import CabinetModel from '../models/armario.model';
import CabinetCategoryModel from '../models/categorias-armario.model';
import LoginModel from '../models/login.model';
import {
  MovementPeriod,
  MovementsParams,
} from '../../../core/services/relatorio.service';

export class ReportRepository {
  async getMedicinesData(): Promise<MedicineReport[]> {
    const results = await MedicineStockModel.findAll({
      attributes: [
        [col('validade'), 'validade'],
        [fn('SUM', col('quantidade')), 'quantidade'],
      ],
      include: [
        {
          model: MedicineModel,
          attributes: ['nome', 'principio_ativo'],
          required: true,
        },
        {
          model: ResidentModel,
          attributes: ['nome'],
          required: false,
        },
      ],
      group: [
        'MedicineModel.nome',
        'MedicineModel.principio_ativo',
        'MedicineStockModel.validade',
        'ResidentModel.nome',
      ],
      order: [
        ['MedicineModel', 'nome', 'ASC'],
        ['validade', 'ASC'],
      ],
      raw: true,
      nest: true,
    });

    return results.map((row: any) => ({
      medicamento: row.MedicineModel?.nome || '',
      principio_ativo: row.MedicineModel?.principio_ativo || '',
      validade: row.validade,
      quantidade: Number(row.quantidade) || 0,
      residente: row.ResidentModel?.nome || null,
    }));
  }

  async getInputsData(): Promise<InputReport[]> {
    const results = await InputStockModel.findAll({
      attributes: [
        [col('validade'), 'validade'],
        [col('armario_id'), 'armario'],
        [fn('SUM', col('quantidade')), 'quantidade'],
      ],
      include: [
        {
          model: InputModel,
          attributes: ['nome'],
          required: true,
        },
        {
          model: ResidentModel,
          attributes: ['nome'],
          required: false,
        },
      ],
      group: [
        'InputModel.nome',
        'InputStockModel.validade',
        'InputStockModel.armario_id',
        'ResidentModel.nome',
      ],
      order: [
        ['InputModel', 'nome', 'ASC'],
        ['validade', 'ASC'],
      ],
      raw: true,
      nest: true,
    });

    return results.map((row: any) => ({
      insumo: row.InputModel?.nome || '',
      validade: row.validade,
      quantidade: Number(row.quantidade) || 0,
      armario: row.armario || null,
      residente: row.ResidentModel?.nome || null,
    }));
  }

  async getResidentsData(): Promise<ResidentReport[]> {
    const results = await MedicineStockModel.findAll({
      attributes: [
        [fn('SUM', col('quantidade')), 'quantidade'],
        [fn('MIN', col('validade')), 'validade'],
      ],
      include: [
        {
          model: MedicineModel,
          attributes: ['nome', 'principio_ativo'],
          required: true,
        },
        {
          model: ResidentModel,
          attributes: ['nome', 'num_casela'],
          required: true,
        },
      ],
      where: {
        casela_id: { [Op.not]: null },
      },
      group: [
        'ResidentModel.nome',
        'ResidentModel.num_casela',
        'MedicineModel.nome',
        'MedicineModel.principio_ativo',
      ],
      order: [
        ['ResidentModel', 'nome', 'ASC'],
        ['MedicineModel', 'nome', 'ASC'],
      ],
      raw: true,
      nest: true,
    });

    return results.map((row: any) => ({
      residente: row.ResidentModel?.nome || '',
      casela: row.ResidentModel?.num_casela || 0,
      medicamento: row.MedicineModel?.nome || '',
      principio_ativo: row.MedicineModel?.principio_ativo || null,
      quantidade: Number(row.quantidade) || 0,
      validade: new Date(row.validade),
    }));
  }

  async getResidentsMonthlyUsage(): Promise<ResidentMonthlyUsage[]> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const results = await MovementModel.findAll({
      attributes: [
        [
          sequelize.literal('DATE_TRUNC(\'month\', "MovementModel"."data")'),
          'data',
        ],
        [fn('SUM', col('quantidade')), 'consumo_mensal'],
      ],
      include: [
        {
          model: MedicineModel,
          attributes: ['nome', 'principio_ativo'],
          required: true,
        },
        {
          model: ResidentModel,
          attributes: ['nome', 'num_casela'],
          required: true,
        },
      ],
      where: {
        tipo: MovementType.SAIDA,
        medicamento_id: { [Op.not]: null },
        casela_id: { [Op.not]: null },
        data: {
          [Op.gte]: startOfMonth,
          [Op.lt]: startOfNextMonth,
        },
      },
      group: [
        'ResidentModel.num_casela',
        'ResidentModel.nome',
        'MedicineModel.id',
        'MedicineModel.nome',
        'MedicineModel.principio_ativo',
        sequelize.literal(
          'DATE_TRUNC(\'month\', "MovementModel"."data")',
        ) as any,
      ],
      order: [
        ['ResidentModel', 'nome', 'ASC'],
        ['MedicineModel', 'nome', 'ASC'],
      ],
      raw: true,
      nest: true,
    });

    return results.map((row: any) => ({
      residente: row.ResidentModel?.nome || '',
      casela: row.ResidentModel?.num_casela || 0,
      medicamento: row.MedicineModel?.nome || '',
      principio_ativo: row.MedicineModel?.principio_ativo || '',
      data: new Date(row.data),
      consumo_mensal: Number(row.consumo_mensal) || 0,
    }));
  }

  async getPsicotropicosData(): Promise<PsicotropicosReport> {
    const results = await MovementModel.findAll({
      attributes: ['tipo', 'data', 'quantidade'],
      include: [
        {
          model: MedicineModel,
          attributes: ['nome'],
          required: true,
        },
        {
          model: ResidentModel,
          attributes: ['nome'],
          required: false,
        },
        {
          model: CabinetModel,
          attributes: [],
          include: [
            {
              model: CabinetCategoryModel,
              attributes: [],
              required: true,
              where: { id: 2 },
            },
          ],
          required: true,
        },
      ],
      where: {
        medicamento_id: { [Op.not]: null },
      },
      order: [['data', 'ASC']],
      raw: true,
      nest: true,
    });

    const formatted = results.map((row: any) => ({
      tipo: row.tipo,
      medicamento: row.MedicineModel?.nome || '',
      residente: row.ResidentModel?.nome || '',
      data_movimentacao: formatDateToPtBr(row.data),
      quantidade: Number(row.quantidade) || 0,
    }));

    return { psicotropico: formatted };
  }

  async getAllItemsData(): Promise<AllItemsReport> {
    const medicines = await MedicineStockModel.findAll({
      attributes: [
        [fn('SUM', col('quantidade')), 'quantidade'],
        [fn('MIN', col('validade')), 'validade'],
      ],
      include: [
        {
          model: MedicineModel,
          attributes: ['nome', 'principio_ativo'],
          required: true,
        },
        {
          model: ResidentModel,
          attributes: ['nome'],
          required: false,
        },
      ],
      group: [
        'MedicineModel.nome',
        'MedicineModel.principio_ativo',
        'ResidentModel.nome',
      ],
      raw: true,
      nest: true,
    });

    const inputs = await InputStockModel.findAll({
      attributes: [
        [fn('SUM', col('quantidade')), 'quantidade'],
        [fn('MIN', col('validade')), 'validade'],
        [col('armario_id'), 'armario'],
      ],
      include: [
        {
          model: InputModel,
          attributes: ['nome'],
          required: true,
        },
        {
          model: ResidentModel,
          attributes: ['nome'],
          required: false,
        },
      ],
      group: [
        'InputModel.nome',
        'InputStockModel.armario_id',
        'ResidentModel.nome',
      ],
      raw: true,
      nest: true,
    });

    return {
      medicamentos: medicines.map((row: any) => ({
        medicamento: row.MedicineModel?.nome || '',
        principio_ativo: row.MedicineModel?.principio_ativo || '',
        quantidade: Number(row.quantidade) || 0,
        validade: row.validade,
        residente: row.ResidentModel?.nome || null,
      })),
      insumos: inputs.map((row: any) => ({
        insumo: row.InputModel?.nome || '',
        quantidade: Number(row.quantidade) || 0,
        armario: row.armario || null,
        validade: row.validade ? new Date(row.validade) : new Date(),
        residente: row.ResidentModel?.nome || null,
      })),
    };
  }

  async getResidentConsumptionReport(
    casela: number,
  ): Promise<ResidentConsumptionReport | null> {
    const resident = await ResidentModel.findByPk(casela);
    if (!resident) {
      return null;
    }

    const medicinesRows = await MedicineStockModel.findAll({
      attributes: [
        [fn('AVG', col('preco')), 'preco'],
        [
          sequelize.literal('COALESCE(SUM(quantidade), 0)'),
          'quantidade_estoque',
        ],
        [
          sequelize.literal(
            "STRING_AGG(DISTINCT observacao, '; ') FILTER (WHERE observacao IS NOT NULL AND observacao != '')",
          ),
          'observacao',
        ],
      ],
      include: [
        {
          model: MedicineModel,
          attributes: [
            'id',
            'nome',
            'dosagem',
            'unidade_medida',
            'principio_ativo',
          ],
          required: true,
        },
      ],
      where: {
        casela_id: casela,
      },
      group: [
        'MedicineModel.id',
        'MedicineModel.nome',
        'MedicineModel.dosagem',
        'MedicineModel.unidade_medida',
        'MedicineModel.principio_ativo',
      ],
      order: [['MedicineModel', 'nome', 'ASC']],
      raw: true,
      nest: true,
    });

    const inputsRows = await InputStockModel.findAll({
      attributes: [
        [fn('AVG', col('preco')), 'preco'],
        [
          sequelize.literal('COALESCE(SUM(quantidade), 0)'),
          'quantidade_estoque',
        ],
      ],
      include: [
        {
          model: InputModel,
          attributes: ['id', 'nome', 'descricao'],
          required: true,
        },
      ],
      where: {
        casela_id: casela,
      },
      group: ['InputModel.id', 'InputModel.nome', 'InputModel.descricao'],
      order: [['InputModel', 'nome', 'ASC']],
      raw: true,
      nest: true,
    });

    const medicines: ResidentConsumptionMedicine[] = medicinesRows.map(
      (row: any) => ({
        nome: row.MedicineModel?.nome || '',
        dosagem: row.MedicineModel?.dosagem || '',
        unidade_medida: row.MedicineModel?.unidade_medida || '',
        principio_ativo: row.MedicineModel?.principio_ativo || '',
        preco: row.preco ? parseFloat(String(row.preco)) : null,
        quantidade_estoque: Number(row.quantidade_estoque) || 0,
        observacao: row.observacao || null,
      }),
    );

    const inputs: ResidentConsumptionInput[] = inputsRows.map((row: any) => ({
      nome: row.InputModel?.nome || '',
      descricao: row.InputModel?.descricao || null,
      preco: row.preco ? parseFloat(String(row.preco)) : null,
      quantidade_estoque: Number(row.quantidade_estoque) || 0,
    }));

    const custosMedicamentos = medicines.map(med => {
      const preco = med.preco || 0;
      const custoMensal = preco;
      const custoAnual = custoMensal * 12;

      return {
        item: 'Medicamento',
        nome: med.nome,
        custo_mensal: Math.round(custoMensal * 100) / 100,
        custo_anual: Math.round(custoAnual * 100) / 100,
      };
    });

    const custosInsumos = inputs.map(input => {
      const preco = input.preco || 0;
      const custoMensal = preco;
      const custoAnual = custoMensal * 12;

      return {
        item: 'Insumo',
        nome: input.nome,
        custo_mensal: Math.round(custoMensal * 100) / 100,
        custo_anual: Math.round(custoAnual * 100) / 100,
      };
    });

    const totalEstimado =
      custosMedicamentos.reduce((sum, c) => sum + c.custo_anual, 0) +
      custosInsumos.reduce((sum, c) => sum + c.custo_anual, 0);

    return {
      residente: resident.nome,
      casela: resident.num_casela,
      medicamentos: medicines,
      insumos: inputs,
      custos_medicamentos: custosMedicamentos,
      custos_insumos: custosInsumos,
      total_estimado: Math.round(totalEstimado * 100) / 100,
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

    const results = await MovementModel.findAll({
      attributes: [
        'data',
        'quantidade',
        'lote',
        'casela_id',
        'armario_id',
        'medicamento_id',
        'insumo_id',
        'destino',
      ],
      include: [
        {
          model: MedicineModel,
          attributes: ['nome', 'principio_ativo'],
          required: false,
        },
        {
          model: InputModel,
          attributes: ['nome', 'descricao'],
          required: false,
        },
        {
          model: ResidentModel,
          attributes: ['nome', 'num_casela'],
          required: false,
        },
        { model: CabinetModel, attributes: ['num_armario'], required: false },
        { model: LoginModel, attributes: ['login'], required: true },

        {
          model: MedicineStockModel,
          attributes: ['observacao'],
          required: false,
          on: {
            [Op.and]: [
              where(
                col('MedicineStockModel.medicamento_id'),
                Op.eq,
                col('MovementModel.medicamento_id'),
              ),
              where(
                col('MedicineStockModel.armario_id'),
                Op.eq,
                col('MovementModel.armario_id'),
              ),
              where(
                col('MedicineStockModel.casela_id'),
                Op.eq,
                col('MovementModel.casela_id'),
              ),
              where(
                col('MedicineStockModel.lote'),
                Op.eq,
                col('MovementModel.lote'),
              ),
            ],
          },
        },

        {
          model: InputStockModel,
          attributes: ['observacao'],
          required: false,
          on: {
            [Op.and]: [
              where(
                col('InputStockModel.insumo_id'),
                Op.eq,
                col('MovementModel.insumo_id'),
              ),
              where(
                col('InputStockModel.armario_id'),
                Op.eq,
                col('MovementModel.armario_id'),
              ),
              where(
                col('InputStockModel.casela_id'),
                Op.eq,
                col('MovementModel.casela_id'),
              ),
              where(
                col('InputStockModel.lote'),
                Op.eq,
                col('MovementModel.lote'),
              ),
            ],
          },
        }

      ],
      where: {
        tipo: MovementType.TRANSFERENCIA,
        setor: 'enfermagem',
        data: {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay,
        },
      },
      order: [['data', 'DESC']],
    });

    return results.map(row => {
      const plain = row.get({ plain: true }) as any;

      const observacao =
        plain.MedicineStockModel?.observacao ??
        plain.InputStockModel?.observacao ??
        null;

      return {
        data: formatDateToPtBr(plain.data),
        nome: plain.MedicineModel?.nome || plain.InputModel?.nome || '',
        principio_ativo: plain.MedicineModel?.principio_ativo || null,
        descricao: plain.InputModel?.descricao || null,
        quantidade: Number(plain.quantidade) || 0,
        casela: plain.ResidentModel?.num_casela || null,
        residente: plain.ResidentModel?.nome || null,
        armario: plain.CabinetModel?.num_armario || null,
        lote: plain.lote || null,
        destino: plain.destino || null,
        observacao,
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
  
    const results = await MovementModel.findAll({
      attributes: [
        'data',
        'quantidade',
        'lote',
        'casela_id',
        'armario_id',
        'medicamento_id',
        'insumo_id',
        'destino',
      ],
      include: [
        { model: MedicineModel, attributes: ['nome', 'principio_ativo'], required: false },
        { model: InputModel, attributes: ['nome', 'descricao'], required: false },
        { model: ResidentModel, attributes: ['nome', 'num_casela'], required: false },
        { model: CabinetModel, attributes: ['num_armario'], required: false },
        { model: LoginModel, attributes: ['login'], required: true },
        {
          model: MedicineStockModel,
          attributes: ['observacao'],
          required: false,
          on: {
            [Op.and]: [
              where(col('MedicineStockModel.medicamento_id'), Op.eq, col('MovementModel.medicamento_id')),
              where(col('MedicineStockModel.armario_id'), Op.eq, col('MovementModel.armario_id')),
              where(col('MedicineStockModel.casela_id'), Op.eq, col('MovementModel.casela_id')),
              where(col('MedicineStockModel.lote'), Op.eq, col('MovementModel.lote')),
            ],
          },
        },
        {
          model: InputStockModel,
          attributes: ['observacao'],
          required: false,
          on: {
            [Op.and]: [
              where(col('InputStockModel.insumo_id'), Op.eq, col('MovementModel.insumo_id')),
              where(col('InputStockModel.armario_id'), Op.eq, col('MovementModel.armario_id')),
              where(col('InputStockModel.casela_id'), Op.eq, col('MovementModel.casela_id')),
              where(col('InputStockModel.lote'), Op.eq, col('MovementModel.lote')),
            ],
          },
        },
      ],
      where: {
        tipo: MovementType.TRANSFERENCIA,
        setor: 'enfermagem',
        data: {
          [Op.between]: [start, end],
        },
      },
      order: [['data', 'DESC']],
    });
  
    return results.map(row => {
      const plain = row.get({ plain: true }) as any;
      const observacao = plain.MedicineStockModel?.observacao ?? plain.InputStockModel?.observacao ?? null;
  
      return {
        data: formatDateToPtBr(plain.data),
        nome: plain.MedicineModel?.nome || plain.InputModel?.nome || '',
        principio_ativo: plain.MedicineModel?.principio_ativo || null,
        descricao: plain.InputModel?.descricao || null,
        quantidade: Number(plain.quantidade) || 0,
        casela: plain.ResidentModel?.num_casela || null,
        residente: plain.ResidentModel?.nome || null,
        armario: plain.CabinetModel?.num_armario || null,
        lote: plain.lote || null,
        destino: plain.destino || null,
        observacao,
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

    const results = await MovementModel.findAll({
      where: {
        data: {
          [Op.between]: [start, end],
        },
      },
      include: [MedicineModel, InputModel, ResidentModel, CabinetModel],
      order: [['data', 'DESC']],
    });

    return results.map(row => {
      const plain = row.get({ plain: true }) as any;

      return {
        data: formatDateToPtBr(plain.data),
        tipo_movimentacao: plain.tipo,
        nome: plain.MedicineModel?.nome || plain.InputModel?.nome || '',
        principio_ativo: plain.MedicineModel?.principio_ativo || null,
        descricao: plain.InputModel?.descricao || null,
        quantidade: Number(plain.quantidade) || 0,
        casela: plain.ResidentModel?.num_casela || null,
        residente: plain.ResidentModel?.nome || null,
        armario: plain.CabinetModel?.num_armario || null,
        gaveta: plain.gaveta_id || null,
        setor: plain.setor,
        lote: plain.lote || null,
        destino: plain.destino || null,
      };
    });
  }

  async getResidentMedicinesData(
    casela: number,
  ): Promise<ResidentMedicinesReport[]> {
    const resident = await ResidentModel.findOne({
      where: { num_casela: casela },
    });

    if (!resident) {
      return [];
    }

    const results = await MedicineStockModel.findAll({
      attributes: [
        [fn('SUM', col('quantidade')), 'quantidade'],
        [fn('MIN', col('validade')), 'validade'],
      ],
      include: [
        {
          model: MedicineModel,
          attributes: ['nome', 'principio_ativo', 'dosagem', 'unidade_medida'],
          required: true,
        },
        {
          model: ResidentModel,
          attributes: ['nome', 'num_casela'],
          required: true,
          where: { num_casela: casela },
        },
      ],
      where: {
        casela_id: { [Op.not]: null },
      },
      group: [
        'ResidentModel.nome',
        'ResidentModel.num_casela',
        'MedicineModel.nome',
        'MedicineModel.principio_ativo',
        'MedicineModel.dosagem',
        'MedicineModel.unidade_medida',
      ],

      order: [['MedicineModel', 'nome', 'ASC']],
      raw: true,
      nest: true,
    });

    return results.map((row: any) => ({
      residente: row.ResidentModel?.nome || '',
      casela: row.ResidentModel?.num_casela || casela,
      medicamento: row.MedicineModel?.nome || '',
      principio_ativo: row.MedicineModel?.principio_ativo || null,
      dosagem:
        `${row.MedicineModel?.dosagem || ''}${row.MedicineModel?.unidade_medida || ''}`.trim(),
      quantidade: Number(row.quantidade) || 0,
      validade: formatDateToPtBr(new Date(row.validade)),
    }));
  }

  async getExpiredMedicinesData(): Promise<ExpiredMedicineReport[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = await MedicineStockModel.findAll({
      attributes: [
        [col('validade'), 'validade'],
        [col('lote'), 'lote'],
        [col('setor'), 'setor'],
        [fn('SUM', col('quantidade')), 'quantidade'],
      ],
      include: [
        {
          model: MedicineModel,
          attributes: ['nome', 'principio_ativo'],
          required: true,
        },
        {
          model: ResidentModel,
          attributes: ['nome'],
          required: false,
        },
      ],
      where: {
        validade: {
          [Op.lt]: today,
        },
      },
      group: [
        'MedicineModel.nome',
        'MedicineModel.principio_ativo',
        'MedicineStockModel.validade',
        'MedicineStockModel.lote',
        'MedicineStockModel.setor',
        'ResidentModel.nome',
      ],
      order: [
        ['validade', 'ASC'],
        ['MedicineModel', 'nome', 'ASC'],
      ],
      raw: true,
      nest: true,
    });

    return results.map((row: any) => {
      const expiryDate = new Date(row.validade);
      const daysExpired = Math.floor(
        (today.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        medicamento: row.MedicineModel?.nome || '',
        principio_ativo: row.MedicineModel?.principio_ativo || '',
        quantidade: Number(row.quantidade) || 0,
        validade: formatDateToPtBr(expiryDate),
        residente: row.ResidentModel?.nome || null,
        dias_vencido: daysExpired,
        lote: row.lote || null,
        setor: row.setor || '',
      };
    });
  }
}
