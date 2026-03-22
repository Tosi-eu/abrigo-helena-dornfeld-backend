import { sequelize } from '../sequelize';
import { Op, fn, col } from 'sequelize';
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
  ExpiringSoonReport,
} from '../models/relatorio.model';
import { ResidentMonthlyUsage, MovementType } from '../../../core/utils/utils';
import {
  formatDateToPtBr,
  formatDateTimeToPtBr,
} from '../../helpers/date.helper';
import {
  formatMedicineName,
  formatCurrency,
} from '../../helpers/format.helper';
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

interface ResidentRow {
  ResidentModel?: { nome?: string; num_casela?: number };
  MedicineModel?: { nome?: string; principio_ativo?: string };
  data?: Date;
  consumo_mensal?: number;
}

interface MedicineReportRow {
  MedicineModel?: { nome?: string; principio_ativo?: string };
  ResidentModel?: { nome?: string };
  validade?: Date | string;
  quantidade?: number | string;
}

interface InputReportRow {
  InputModel?: { nome?: string };
  ResidentModel?: { nome?: string };
  validade?: Date | string;
  armario?: number | null;
  quantidade?: number | string;
}

interface ResidentConsumptionRow {
  MedicineModel?: {
    nome?: string;
    dosagem?: string;
    unidade_medida?: string;
    principio_ativo?: string;
    preco?: number;
  };
  InputModel?: { nome?: string; descricao?: string | null; preco?: number };
  quantidade_estoque?: number | string;
  observacao?: string | null;
}

interface ResidentReportRawRow {
  ResidentModel?: { nome?: string; num_casela?: number };
  MedicineModel?: { nome?: string; principio_ativo?: string };
  quantidade?: number | string;
  validade?: Date | string;
}

interface ResidentMedicineReportRow {
  ResidentModel?: { nome?: string; num_casela?: number };
  MedicineModel?: {
    nome?: string;
    dosagem?: string;
    unidade_medida?: string;
    principio_ativo?: string;
  };
  quantidade?: number | string;
  validade?: Date | string;
}

interface ExpiringReportRow {
  MedicineModel?: { nome?: string; principio_ativo?: string };
  InputModel?: { nome?: string; descricao?: string | null };
  ResidentModel?: { nome?: string };
  validade?: Date | string;
  quantidade?: number | string;
  lote?: string | null;
  setor?: string;
  armario?: number | null;
  gaveta?: number | null;
}

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

    return (results as MedicineReportRow[]).map(row => ({
      medicamento: row.MedicineModel?.nome || '',
      principio_ativo: row.MedicineModel?.principio_ativo || '',
      validade: row.validade != null ? String(row.validade) : '',
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

    return (results as InputReportRow[]).map(row => ({
      insumo: row.InputModel?.nome || '',
      validade: row.validade != null ? new Date(row.validade) : new Date(),
      quantidade: Number(row.quantidade) || 0,
      armario: row.armario ?? 0,
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

    return (results as ResidentReportRawRow[]).map(row => ({
      residente: row.ResidentModel?.nome || '',
      casela: row.ResidentModel?.num_casela || 0,
      medicamento: row.MedicineModel?.nome || '',
      principio_ativo: row.MedicineModel?.principio_ativo || null,
      quantidade: Number(row.quantidade) || 0,
      validade: new Date(row.validade as Date | string),
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Sequelize literal typing
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

    return (results as ResidentRow[]).map(row => ({
      residente: row.ResidentModel?.nome || '',
      casela: row.ResidentModel?.num_casela || 0,
      medicamento: row.MedicineModel?.nome || '',
      principio_ativo: row.MedicineModel?.principio_ativo || '',
      data: new Date(row.data as Date),
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

    interface PsicotropicoRawRow {
      tipo: string;
      data: Date | string;
      quantidade?: number | string;
      MedicineModel?: { nome?: string };
      ResidentModel?: { nome?: string };
    }
    const formatted = (results as PsicotropicoRawRow[]).map(row => ({
      tipo: row.tipo as MovementType,
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
      medicamentos: (medicines as MedicineReportRow[]).map(row => ({
        medicamento: row.MedicineModel?.nome || '',
        principio_ativo: row.MedicineModel?.principio_ativo || '',
        quantidade: Number(row.quantidade) || 0,
        validade: row.validade != null ? String(row.validade) : '',
        residente: row.ResidentModel?.nome || null,
      })),
      insumos: (inputs as InputReportRow[]).map(row => ({
        insumo: row.InputModel?.nome || '',
        quantidade: Number(row.quantidade) || 0,
        armario: row.armario ?? 0,
        validade: row.validade ? new Date(row.validade as string) : new Date(),
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
            'preco',
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
        'MedicineModel.preco',
      ],
      order: [['MedicineModel', 'nome', 'ASC']],
      raw: true,
      nest: true,
    });

    const inputsRows = await InputStockModel.findAll({
      attributes: [
        [
          sequelize.literal('COALESCE(SUM(quantidade), 0)'),
          'quantidade_estoque',
        ],
      ],
      include: [
        {
          model: InputModel,
          attributes: ['id', 'nome', 'descricao', 'preco'],
          required: true,
        },
      ],
      where: {
        casela_id: casela,
      },
      group: [
        'InputModel.id',
        'InputModel.nome',
        'InputModel.descricao',
        'InputModel.preco',
      ],
      order: [['InputModel', 'nome', 'ASC']],
      raw: true,
      nest: true,
    });

    const medicines: ResidentConsumptionMedicine[] = (
      medicinesRows as ResidentConsumptionRow[]
    ).map(row => {
      const nome = row.MedicineModel?.nome || '';
      const dosagem = row.MedicineModel?.dosagem || '';
      const unidadeMedida = row.MedicineModel?.unidade_medida || '';
      const preco = row.MedicineModel?.preco
        ? parseFloat(String(row.MedicineModel.preco))
        : null;

      return {
        nome: formatMedicineName(nome, dosagem, unidadeMedida),
        principio_ativo: row.MedicineModel?.principio_ativo || '',
        preco_formatado: formatCurrency(preco),
        quantidade_estoque: Number(row.quantidade_estoque) || 0,
        observacao: row.observacao || null,
      };
    });

    const inputs: ResidentConsumptionInput[] = (
      inputsRows as ResidentConsumptionRow[]
    ).map(row => {
      const preco = row.InputModel?.preco
        ? parseFloat(String(row.InputModel.preco))
        : null;

      return {
        nome: row.InputModel?.nome || '',
        descricao: row.InputModel?.descricao || null,
        preco_formatado: formatCurrency(preco),
        quantidade_estoque: Number(row.quantidade_estoque) || 0,
      };
    });

    const custosMedicamentos = (medicinesRows as ResidentConsumptionRow[]).map(
      row => {
        const nome = row.MedicineModel?.nome || '';
        const dosagem = row.MedicineModel?.dosagem || '';
        const unidadeMedida = row.MedicineModel?.unidade_medida || '';
        const preco = row.MedicineModel?.preco
          ? parseFloat(String(row.MedicineModel.preco))
          : 0;
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
      },
    );

    const custosInsumos = (inputsRows as ResidentConsumptionRow[]).map(row => {
      const preco = row.InputModel?.preco
        ? parseFloat(String(row.InputModel.preco))
        : 0;
      const custoMensal = preco;
      const custoAnual = custoMensal * 12;

      return {
        item: 'Insumo',
        nome: row.InputModel?.nome || '',
        custo_mensal_formatado: formatCurrency(custoMensal),
        custo_anual_formatado: formatCurrency(custoAnual),
      };
    });

    const totalEstimado =
      (medicinesRows as ResidentConsumptionRow[]).reduce((sum, row) => {
        const preco = row.MedicineModel?.preco
          ? parseFloat(String(row.MedicineModel.preco))
          : 0;
        return sum + preco * 12;
      }, 0) +
      (inputsRows as ResidentConsumptionRow[]).reduce((sum, row) => {
        const preco = row.InputModel?.preco
          ? parseFloat(String(row.InputModel.preco))
          : 0;
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

    const results = await MovementModel.findAll({
      attributes: [
        'id',
        'data',
        'quantidade',
        'lote',
        'casela_id',
        'armario_id',
        'medicamento_id',
        'insumo_id',
        'destino',
        'observacao',
      ],
      include: [
        {
          model: MedicineModel,
          attributes: ['nome', 'principio_ativo', 'dosagem', 'unidade_medida'],
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
        { model: LoginModel, attributes: ['login'], required: false },
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
      const plain = row.get({ plain: true }) as MovementPlain;

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
        casela: plain.ResidentModel?.num_casela || null,
        residente: plain.ResidentModel?.nome || null,
        armario: plain.CabinetModel?.num_armario || null,
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

    const results = await MovementModel.findAll({
      attributes: [
        'id',
        'data',
        'quantidade',
        'lote',
        'casela_id',
        'armario_id',
        'medicamento_id',
        'insumo_id',
        'destino',
        'observacao',
      ],
      include: [
        {
          model: MedicineModel,
          attributes: ['nome', 'principio_ativo', 'dosagem', 'unidade_medida'],
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
        { model: LoginModel, attributes: ['login'], required: false },
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
      const plain = row.get({ plain: true }) as MovementPlain;

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
        casela: plain.ResidentModel?.num_casela || null,
        residente: plain.ResidentModel?.nome || null,
        armario: plain.CabinetModel?.num_armario || null,
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
      const plain = row.get({ plain: true }) as MovementPlain;
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
        casela: plain.ResidentModel?.num_casela || null,
        residente: plain.ResidentModel?.nome || null,
        armario: plain.CabinetModel?.num_armario || null,
        gaveta: plain.gaveta_id || null,
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

    return (results as ResidentMedicineReportRow[]).map(row => {
      const nome = row.MedicineModel?.nome || '';
      const dosagem = row.MedicineModel?.dosagem || '';
      const unidadeMedida = row.MedicineModel?.unidade_medida || '';

      return {
        residente: row.ResidentModel?.nome || '',
        casela: row.ResidentModel?.num_casela ?? casela,
        medicamento: formatMedicineName(nome, dosagem, unidadeMedida),
        principio_ativo: row.MedicineModel?.principio_ativo ?? '',
        quantidade: Number(row.quantidade) || 0,
        validade: formatDateToPtBr(new Date(row.validade as string)),
      };
    });
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

    return (results as ExpiringReportRow[]).map(row => {
      const expiryDate = new Date(row.validade as string);
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

  async getExpiringSoonData(): Promise<ExpiringSoonReport[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in45Days = new Date(today);
    in45Days.setDate(today.getDate() + 45);

    const results: ExpiringSoonReport[] = [];

    const medicines = await MedicineStockModel.findAll({
      attributes: [
        [col('validade'), 'validade'],
        [col('lote'), 'lote'],
        [col('setor'), 'setor'],
        [col('armario_id'), 'armario'],
        [col('gaveta_id'), 'gaveta'],
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
          [Op.gte]: today,
          [Op.lte]: in45Days,
        },
        quantidade: {
          [Op.gt]: 0,
        },
      },
      group: [
        'MedicineModel.nome',
        'MedicineModel.principio_ativo',
        'MedicineStockModel.validade',
        'MedicineStockModel.lote',
        'MedicineStockModel.setor',
        'MedicineStockModel.armario_id',
        'MedicineStockModel.gaveta_id',
        'ResidentModel.nome',
      ],
      order: [
        ['validade', 'ASC'],
        ['MedicineModel', 'nome', 'ASC'],
      ],
      raw: true,
      nest: true,
    });

    (medicines as ExpiringReportRow[]).forEach(row => {
      const expiryDate = new Date(row.validade as string);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      results.push({
        tipo: 'medicamento',
        nome: row.MedicineModel?.nome || '',
        principio_ativo: row.MedicineModel?.principio_ativo || null,
        quantidade: Number(row.quantidade) || 0,
        validade: formatDateToPtBr(expiryDate),
        dias_para_vencer: daysUntilExpiry,
        residente: row.ResidentModel?.nome || null,
        lote: row.lote || null,
        setor: row.setor || '',
        armario: row.armario || null,
        gaveta: row.gaveta || null,
      });
    });

    const inputs = await InputStockModel.findAll({
      attributes: [
        [col('validade'), 'validade'],
        [col('lote'), 'lote'],
        [col('setor'), 'setor'],
        [col('armario_id'), 'armario'],
        [col('gaveta_id'), 'gaveta'],
        [fn('SUM', col('quantidade')), 'quantidade'],
      ],
      include: [
        {
          model: InputModel,
          attributes: ['nome', 'descricao'],
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
          [Op.gte]: today,
          [Op.lte]: in45Days,
        },
        quantidade: {
          [Op.gt]: 0,
        },
      },
      group: [
        'InputModel.nome',
        'InputModel.descricao',
        'InputStockModel.validade',
        'InputStockModel.lote',
        'InputStockModel.setor',
        'InputStockModel.armario_id',
        'InputStockModel.gaveta_id',
        'ResidentModel.nome',
      ],
      order: [
        ['validade', 'ASC'],
        ['InputModel', 'nome', 'ASC'],
      ],
      raw: true,
      nest: true,
    });

    (inputs as ExpiringReportRow[]).forEach(row => {
      const expiryDate = new Date(row.validade as string);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      results.push({
        tipo: 'insumo',
        nome: row.InputModel?.nome || '',
        descricao: row.InputModel?.descricao || null,
        quantidade: Number(row.quantidade) || 0,
        validade: formatDateToPtBr(expiryDate),
        dias_para_vencer: daysUntilExpiry,
        residente: row.ResidentModel?.nome || null,
        lote: row.lote || null,
        setor: row.setor || '',
        armario: row.armario || null,
        gaveta: row.gaveta || null,
      });
    });

    return results.sort((a, b) => a.dias_para_vencer - b.dias_para_vencer);
  }
}
