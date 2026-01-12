import { sequelize } from '../sequelize';
import { Op, fn, col } from 'sequelize';
import {
  AllItemsReport,
  InputReport,
  MedicineReport,
  PsicotropicoData,
  PsicotropicosReport,
  ResidentConsumptionReport,
  ResidentConsumptionMedicine,
  ResidentConsumptionInput,
  ResidentReport,
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
          sequelize.literal("DATE_TRUNC('month', \"MovementModel\".\"data\")"),
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
        sequelize.literal("DATE_TRUNC('month', \"MovementModel\".\"data\")") as any,
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

  async getResidentConsumptionReport(casela: number): Promise<ResidentConsumptionReport | null> {
    const resident = await ResidentModel.findByPk(casela);
    if (!resident) {
      return null;
    }

    const medicinesRows = await MedicineStockModel.findAll({
      attributes: [
        [fn('AVG', col('preco')), 'preco'],
        [
          sequelize.literal("COALESCE(SUM(quantidade), 0)"),
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
          attributes: ['id', 'nome', 'dosagem', 'unidade_medida', 'principio_ativo'],
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
          sequelize.literal("COALESCE(SUM(quantidade), 0)"),
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

    const medicines: ResidentConsumptionMedicine[] = medicinesRows.map((row: any) => ({
      nome: row.MedicineModel?.nome || '',
      dosagem: row.MedicineModel?.dosagem || '',
      unidade_medida: row.MedicineModel?.unidade_medida || '',
      principio_ativo: row.MedicineModel?.principio_ativo || '',
      preco: row.preco ? parseFloat(String(row.preco)) : null,
      quantidade_estoque: Number(row.quantidade_estoque) || 0,
      observacao: row.observacao || null,
    }));

    const inputs: ResidentConsumptionInput[] = inputsRows.map((row: any) => ({
      nome: row.InputModel?.nome || '',
      descricao: row.InputModel?.descricao || null,
      preco: row.preco ? parseFloat(String(row.preco)) : null,
      quantidade_estoque: Number(row.quantidade_estoque) || 0,
    }));

    const custosMedicamentos = medicines.map((med) => {
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

    const custosInsumos = inputs.map((input) => {
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
}
