import { MedicineStock, InputStock } from '../../../core/domain/estoque';
import MedicineStockModel, {
  MedicineStockAttributes,
} from '../models/estoque-medicamento.model';
import InputStockModel, {
  InputStockAttributes,
} from '../models/estoque-insumo.model';
import { Op, fn, col } from 'sequelize';
import type { Transaction } from 'sequelize';
import { sequelize } from '../sequelize';
import MedicineModel from '../models/medicamento.model';
import InputModel from '../models/insumo.model';
import ResidentModel from '../models/residente.model';
import CabinetModel from '../models/armario.model';
import DrawerModel from '../models/gaveta.model';
import {
  computeExpiryStatus,
  computeQuantityStatus,
} from '../../helpers/expiry-status';
import {
  ItemType,
  StockItemStatus,
  OperationType,
  QueryPaginationParams,
  SectorType,
  StockFilterType,
  StockQueryType,
} from '../../../core/utils/utils';
import {
  formatDateToPtBr,
  getTodayAtNoonBrazil,
} from '../../helpers/date.helper';
import type { WhereOptions } from 'sequelize';
import {
  SECTOR_CONFIG,
  StockGroup,
  StockQueryResult,
  MedicineStockPlain,
  InputStockPlain,
  ExpiringStockItem,
} from '../../types/estoque.types';
import type { AggregateRow } from '../../types/sequelize.types';

interface StockModel {
  sum(
    field: string,
    options?: {
      where?: Record<string, unknown>;
      transaction?: Transaction;
    },
  ): Promise<number | null>;
}

export class StockRepository {
  async createMedicineStockIn(
    data: MedicineStock,
    tenantId: number,
    transaction?: Transaction,
  ) {
    try {
      const existing = await MedicineStockModel.findOne({
        where: {
          medicamento_id: data.medicamento_id,
          armario_id: data.armario_id,
          gaveta_id: data.gaveta_id,
          validade: data.validade ?? null,
          tipo: data.tipo,
          casela_id: data.casela_id ?? null,
          origem: data.origem,
          lote: data.lote ?? null,
        },
        transaction,
      });

      if (existing) {
        existing.quantidade += data.quantidade;
        await existing.save({ transaction });
        const plain = existing.get({ plain: true });
        return {
          message: 'Quantidade somada ao estoque existente.',
          data: plain,
        };
      }

      const created = await MedicineStockModel.create(
        {
          tenant_id: tenantId,
          medicamento_id: data.medicamento_id,
          casela_id: data.casela_id ?? null,
          armario_id: data.armario_id,
          gaveta_id: data.gaveta_id,
          validade: data.validade,
          quantidade: data.quantidade,
          origem: data.origem,
          tipo: data.tipo,
          setor: data.setor,
          lote: data.lote ?? null,
          observacao: data.observacao ?? null,
        },
        { transaction },
      );

      return {
        message: 'Entrada de medicamento registrada.',
        data: created.get({ plain: true }),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(message);
    }
  }

  async createInputStockIn(
    data: InputStock,
    tenantId: number,
    transaction?: Transaction,
  ) {
    const existing = await InputStockModel.findOne({
      where: {
        insumo_id: data.insumo_id,
        armario_id: data.armario_id,
        gaveta_id: data.gaveta_id,
        validade: data.validade ?? null,
        tipo: data.tipo,
        casela_id: data.casela_id ?? null,
        lote: data.lote ?? null,
      },
      transaction,
    });

    if (data.casela_id && data.tipo !== OperationType.INDIVIDUAL) {
      throw new Error('Casela só pode ser usada para insumo individual');
    }

    if (existing) {
      existing.quantidade += data.quantidade;
      await existing.save({ transaction });
      const plain = existing.get({ plain: true });
      return {
        message: 'Quantidade somada ao estoque existente.',
        data: plain,
      };
    }

    const created = await InputStockModel.create(
      {
        tenant_id: tenantId,
        insumo_id: data.insumo_id,
        casela_id: data.casela_id ?? null,
        armario_id: data.armario_id,
        gaveta_id: data.gaveta_id,
        quantidade: data.quantidade,
        validade: data.validade,
        tipo: data.tipo,
        setor: data.setor,
        lote: data.lote ?? null,
        status: data.status ?? StockItemStatus.ATIVO,
        suspended_at: data.suspended_at ?? null,
      },
      { transaction },
    );

    return {
      message: 'Entrada de insumo registrada.',
      data: created.get({ plain: true }),
    };
  }

  async createStockOut(
    estoqueId: number,
    tipoItem: ItemType,
    quantidade: number,
    transaction?: Transaction,
  ) {
    if (tipoItem === 'medicamento') {
      const register = await MedicineStockModel.findByPk(estoqueId, {
        transaction,
      });

      if (!register) throw new Error('register de medicamento não encontrado.');

      if (register.quantidade < quantidade)
        throw new Error('Quantidade insuficiente.');

      if (register?.status === StockItemStatus.SUSPENSO) {
        throw new Error('Medicamento suspenso não pode ser movimentado');
      }

      register.quantidade -= quantidade;
      await register.save({ transaction });
      return {
        message: 'Saída de medicamento realizada.',
        data: register.get({ plain: true }),
      };
    } else {
      const register = await InputStockModel.findByPk(estoqueId, {
        transaction,
      });
      if (!register) throw new Error('register de insumo não encontrado.');
      if (register.quantidade < quantidade)
        throw new Error('Quantidade insuficiente.');

      if (register?.status === StockItemStatus.SUSPENSO) {
        throw new Error('Insumo suspenso não pode ser movimentado');
      }

      register.quantidade -= quantidade;
      await register.save({ transaction });
      return {
        message: 'Saída de insumo realizada.',
        data: register.get({ plain: true }),
      };
    }
  }

  async listStockItems(
    params: QueryPaginationParams,
    transaction?: Transaction,
  ) {
    const { filter, type, page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    if (type === 'armarios') {
      const cabinets = await CabinetModel.findAll({
        order: [['num_armario', 'ASC']],
        attributes: ['num_armario'],
        transaction,
      });

      const cabinetIds = cabinets.map(c => c.num_armario);

      const medicineTotals = await MedicineStockModel.findAll({
        attributes: ['armario_id', [fn('SUM', col('quantidade')), 'total']],
        where: {
          armario_id: { [Op.in]: cabinetIds },
        },
        group: ['armario_id'],
        raw: true,
        transaction,
      });

      const inputTotals = await InputStockModel.findAll({
        attributes: ['armario_id', [fn('SUM', col('quantidade')), 'total']],
        where: {
          armario_id: { [Op.in]: cabinetIds },
        },
        group: ['armario_id'],
        raw: true,
        transaction,
      });

      const medicineMap = new Map(
        (medicineTotals as unknown as AggregateRow[]).map(item => [
          item.armario_id as number,
          Number(item.total || 0),
        ]),
      );
      const inputMap = new Map(
        (inputTotals as unknown as AggregateRow[]).map(item => [
          item.armario_id as number,
          Number(item.total || 0),
        ]),
      );

      const results = cabinets.map(cabinet => {
        const totalMedicamentos = medicineMap.get(cabinet.num_armario) || 0;
        const totalInsumos = inputMap.get(cabinet.num_armario) || 0;

        return {
          armario_id: cabinet.num_armario,
          total_medicamentos: totalMedicamentos,
          total_insumos: totalInsumos,
          total_geral: totalMedicamentos + totalInsumos,
        };
      });

      return {
        data: results,
        total: results.length,
        page,
        limit,
        hasNext: false,
      };
    }

    if (type === StockQueryType.GAVETAS) {
      const drawers = await DrawerModel.findAll({
        order: [['num_gaveta', 'ASC']],
        attributes: ['num_gaveta'],
        transaction,
      });

      const drawerIds = drawers.map(d => d.num_gaveta);

      const medicineTotals = await MedicineStockModel.findAll({
        attributes: ['gaveta_id', [fn('SUM', col('quantidade')), 'total']],
        where: {
          gaveta_id: { [Op.in]: drawerIds },
        },
        group: ['gaveta_id'],
        raw: true,
        transaction,
      });

      const inputTotals = await InputStockModel.findAll({
        attributes: ['gaveta_id', [fn('SUM', col('quantidade')), 'total']],
        where: {
          gaveta_id: { [Op.in]: drawerIds },
        },
        group: ['gaveta_id'],
        raw: true,
        transaction,
      });

      const medicineMap = new Map(
        (medicineTotals as unknown as AggregateRow[]).map(item => [
          item.gaveta_id as number,
          Number(item.total || 0),
        ]),
      );
      const inputMap = new Map(
        (inputTotals as unknown as AggregateRow[]).map(item => [
          item.gaveta_id as number,
          Number(item.total || 0),
        ]),
      );

      const results = drawers.map(drawer => {
        const totalMedicamentos = medicineMap.get(drawer.num_gaveta) || 0;
        const totalInsumos = inputMap.get(drawer.num_gaveta) || 0;

        return {
          gaveta_id: drawer.num_gaveta,
          total_medicamentos: totalMedicamentos,
          total_insumos: totalInsumos,
          total_geral: totalMedicamentos + totalInsumos,
        };
      });

      return {
        data: results,
        total: results.length,
        page,
        limit,
        hasNext: false,
      };
    }

    const buildWhereCondition = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const in45Days = new Date(today);
      in45Days.setDate(in45Days.getDate() + 45);

      const baseWhere: WhereOptions = {};

      switch (filter) {
        case 'belowMin':
          baseWhere.quantidade = { [Op.gte]: 0 };
          break;

        case 'expired':
          baseWhere.quantidade = { [Op.gt]: 0 };
          baseWhere.validade = { [Op.lt]: today };
          break;

        case 'expiringSoon':
          baseWhere.quantidade = { [Op.gt]: 0 };
          baseWhere.validade = { [Op.between]: [today, in45Days] };
          break;

        case 'nearMin':
          break;

        default:
          break;
      }

      return baseWhere;
    };

    const whereCondition = buildWhereCondition();
    const results: StockQueryResult[] = [];

    const shouldIncludeMedicines =
      !params.itemType || params.itemType === 'medicamento';
    const shouldIncludeInputs =
      !params.itemType || params.itemType === 'insumo';

    if ((!type || type === 'medicamento') && shouldIncludeMedicines) {
      const medicineWhere: WhereOptions = { ...whereCondition };

      if (params.cabinet) {
        medicineWhere.armario_id = Number(params.cabinet);
      }
      if (params.drawer) {
        medicineWhere.gaveta_id = Number(params.drawer);
      }
      if (params.casela) {
        medicineWhere.casela_id = Number(params.casela);
      }
      if (params.sector) {
        medicineWhere.setor = params.sector;
      }
      if (params.lot) {
        medicineWhere.lote = {
          [Op.iLike]: `%${params.lot}%`,
        };
      }

      const medicineIncludeWhere: WhereOptions = {};
      if (params.name && params.name.trim()) {
        medicineIncludeWhere.nome = {
          [Op.iLike]: `%${params.name.trim()}%`,
        };
      }

      const medicineStocks = await MedicineStockModel.findAll({
        where: medicineWhere,
        include: [
          {
            model: MedicineModel,
            attributes: [
              'id',
              'nome',
              'principio_ativo',
              'dosagem',
              'unidade_medida',
              'estoque_minimo',
            ],
            required: true,
            where:
              Object.keys(medicineIncludeWhere).length > 0
                ? medicineIncludeWhere
                : undefined,
          },
          {
            model: ResidentModel,
            attributes: ['nome'],
            required: false,
          },
        ],
        order: [['id', 'ASC']],
        limit: !type ? undefined : limit,
        offset: !type ? undefined : offset,
        transaction,
      });

      for (const stock of medicineStocks) {
        const plainStock = stock.get({ plain: true }) as MedicineStockPlain;
        const medicine = plainStock.MedicineModel;
        const resident = plainStock.ResidentModel;

        if (filter === 'belowMin') {
          const minStock = medicine?.estoque_minimo ?? 0;
          if (stock.quantidade >= minStock) continue;
        }

        if (filter === 'nearMin') {
          const minStock = medicine?.estoque_minimo ?? 0;
          if (minStock === 0) continue;
          if (stock.quantidade <= minStock) continue;
          const upperLimit = minStock * 1.35;
          if (stock.quantidade > upperLimit) continue;
        }

        results.push({
          tipo_item: 'medicamento',
          estoque_id: stock.id,
          item_id: medicine?.id,
          nome: medicine?.nome,
          principio_ativo: medicine?.principio_ativo || null,
          dosagem: medicine?.dosagem || null,
          unidade_medida: medicine?.unidade_medida || null,
          descricao: null,
          validade: stock.validade,
          quantidade: stock.quantidade,
          minimo: medicine?.estoque_minimo || 0,
          origem: stock.origem || null,
          tipo: stock.tipo || null,
          paciente: resident?.nome || null,
          armario_id: stock.armario_id || null,
          gaveta_id: stock.gaveta_id || null,
          casela_id: stock.casela_id || null,
          setor: stock.setor,
          status: stock.status || null,
          suspenso_em: stock.suspended_at || null,
          lote: stock.lote || null,
          observacao: stock.observacao || null,
          dias_para_repor: stock.dias_para_repor ?? null,
          destino: null,
        } as StockQueryResult);
      }
    }

    if ((!type || type === 'insumo') && shouldIncludeInputs) {
      const inputWhere: WhereOptions = { ...whereCondition };

      if (filter === 'nearMin') {
        inputWhere.quantidade = { [Op.gt]: 0 };
      }

      if (params.cabinet) {
        inputWhere.armario_id = Number(params.cabinet);
      }
      if (params.drawer) {
        inputWhere.gaveta_id = Number(params.drawer);
      }
      if (params.casela) {
        inputWhere.casela_id = Number(params.casela);
      }
      if (params.sector) {
        inputWhere.setor = params.sector;
      }
      if (params.lot) {
        inputWhere.lote = {
          [Op.iLike]: `%${params.lot}%`,
        };
      }

      const inputIncludeWhere: WhereOptions = {};
      if (params.name && params.name.trim()) {
        inputIncludeWhere.nome = {
          [Op.iLike]: `%${params.name.trim()}%`,
        };
      }

      const inputStocks = await InputStockModel.findAll({
        where: inputWhere,
        include: [
          {
            model: InputModel,
            attributes: ['id', 'nome', 'descricao', 'estoque_minimo'],
            required: true,
            where:
              Object.keys(inputIncludeWhere).length > 0
                ? inputIncludeWhere
                : undefined,
          },
          {
            model: ResidentModel,
            attributes: ['nome'],
            required: false,
          },
        ],
        order: [['id', 'ASC']],
        limit: !type ? undefined : limit,
        offset: !type ? undefined : offset,
        transaction,
      });

      for (const stock of inputStocks) {
        const plainStock = stock.get({ plain: true }) as InputStockPlain;
        const input = plainStock.InputModel;
        const resident = plainStock.ResidentModel;

        if (filter === StockFilterType.BELOW_MIN) {
          const minStock = input?.estoque_minimo ?? 0;
          if (stock.quantidade >= minStock) continue;
        }

        if (filter === StockFilterType.NEAR_MIN) {
          const minStock = input?.estoque_minimo ?? 0;
          if (minStock === 0) continue;
          if (stock.quantidade <= minStock) continue;
          const upperLimit = minStock * 1.2;
          if (stock.quantidade > upperLimit) continue;
        }

        results.push({
          tipo_item: 'insumo',
          estoque_id: stock.id,
          item_id: input?.id,
          nome: input?.nome,
          principio_ativo: null,
          descricao: input?.descricao || null,
          validade: stock.validade,
          quantidade: stock.quantidade,
          minimo: input?.estoque_minimo || 0,
          origem: null,
          tipo: stock.tipo,
          paciente: resident?.nome || null,
          armario_id: stock.armario_id || null,
          gaveta_id: stock.gaveta_id || null,
          casela_id: stock.casela_id || null,
          setor: stock.setor,
          status: stock.status || null,
          suspenso_em: stock.suspended_at || null,
          destino: stock.destino || null,
          lote: stock.lote || null,
          observacao: stock.observacao || null,
          dias_para_repor: stock.dias_para_repor ?? null,
        } as StockQueryResult);
      }
    }

    results.sort((a, b) => {
      const nomeA = (a.nome || '').toLowerCase();
      const nomeB = (b.nome || '').toLowerCase();
      return nomeA.localeCompare(nomeB);
    });

    const total = results.length;
    const paginatedResults = !type
      ? results.slice(offset, offset + limit)
      : results;

    const mapped = paginatedResults.map((item: StockQueryResult) => {
      let expiryInfo: { status: string | null; message: string | null } = {
        status: null,
        message: null,
      };
      let quantityInfo: { status: string | null; message: string | null } = {
        status: null,
        message: null,
      };

      if (item.validade) {
        const validadeDate =
          item.validade instanceof Date
            ? item.validade
            : new Date(item.validade as string);
        expiryInfo = computeExpiryStatus(validadeDate);
        quantityInfo = computeQuantityStatus(
          item.quantidade ?? 0,
          item.minimo ?? 0,
        );
      }

      return {
        ...item,
        validade: item.validade ? formatDateToPtBr(item.validade) : null,
        st_expiracao: expiryInfo.status,
        msg_expiracao: expiryInfo.message,
        st_quantidade: quantityInfo.status,
        msg_quantidade: quantityInfo.message,
      };
    });

    return {
      data: mapped,
      total,
      page,
      limit,
      hasNext: total > page * limit,
    };
  }

  async getFilterOptions(transaction?: Transaction) {
    const [medCabinets, inpCabinets, medCaselas, inpCaselas, medLots, inpLots] =
      await Promise.all([
        MedicineStockModel.findAll({
          attributes: ['armario_id'],
          where: { armario_id: { [Op.not]: null } },
          group: ['armario_id'],
          raw: true,
          transaction,
        }),
        InputStockModel.findAll({
          attributes: ['armario_id'],
          where: { armario_id: { [Op.not]: null } },
          group: ['armario_id'],
          raw: true,
          transaction,
        }),
        MedicineStockModel.findAll({
          attributes: ['casela_id'],
          where: { casela_id: { [Op.not]: null } },
          group: ['casela_id'],
          raw: true,
          transaction,
        }),
        InputStockModel.findAll({
          attributes: ['casela_id'],
          where: { casela_id: { [Op.not]: null } },
          group: ['casela_id'],
          raw: true,
          transaction,
        }),
        MedicineStockModel.findAll({
          attributes: ['lote'],
          where: {
            [Op.and]: [{ lote: { [Op.ne]: null } }, { lote: { [Op.ne]: '' } }],
          },
          group: ['lote'],
          raw: true,
          transaction,
        }),
        InputStockModel.findAll({
          attributes: ['lote'],
          where: {
            [Op.and]: [{ lote: { [Op.ne]: null } }, { lote: { [Op.ne]: '' } }],
          },
          group: ['lote'],
          raw: true,
          transaction,
        }),
      ]);

    const cabinets = Array.from(
      new Set([
        ...(medCabinets as { armario_id: number }[]).map(r => r.armario_id),
        ...(inpCabinets as { armario_id: number }[]).map(r => r.armario_id),
      ]),
    ).sort((a, b) => a - b);

    const caselas = Array.from(
      new Set([
        ...(medCaselas as { casela_id: number }[]).map(r => r.casela_id),
        ...(inpCaselas as { casela_id: number }[]).map(r => r.casela_id),
      ]),
    ).sort((a, b) => a - b);

    const lots = Array.from(
      new Set([
        ...(medLots as { lote: string }[]).map(r => r.lote),
        ...(inpLots as { lote: string }[]).map(r => r.lote),
      ]),
    )
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b)));

    return { cabinets, caselas, lots };
  }

  private async sumStock(
    model: StockModel,
    options?: {
      setor?: SectorType;
      tipos?: OperationType[];
    },
    transaction?: Transaction,
  ): Promise<number> {
    const result = await model.sum('quantidade', {
      where: {
        ...(options?.setor && { setor: options.setor }),
        ...(options?.tipos && { tipo: { [Op.in]: options.tipos } }),
      },
      transaction,
    });

    return Number(result || 0);
  }

  async getStockProportionBySector(
    setor?: SectorType,
    transaction?: Transaction,
  ): Promise<Record<StockGroup, number>> {
    const baseResult: Record<StockGroup, number> = {
      medicamentos_geral: 0,
      medicamentos_individual: 0,
      insumos_geral: 0,
      insumos_individual: 0,
      carrinho_emergencia_medicamentos: 0,
      carrinho_psicotropicos_medicamentos: 0,
      carrinho_emergencia_insumos: 0,
      carrinho_psicotropicos_insumos: 0,
    };

    if (!setor) {
      const [
        medicamentosGeral,
        medicamentosIndividual,
        insumosGeral,
        insumosIndividual,

        carrinhoEmergenciaMedicamentos,
        carrinhoPsicotropicosMedicamentos,

        carrinhoEmergenciaInsumos,
        carrinhoPsicotropicosInsumos,
      ] = await Promise.all([
        this.sumStock(
          MedicineStockModel,
          {
            tipos: [OperationType.GERAL],
          },
          transaction,
        ),
        this.sumStock(
          MedicineStockModel,
          {
            tipos: [OperationType.INDIVIDUAL],
          },
          transaction,
        ),
        this.sumStock(
          InputStockModel,
          {
            tipos: [OperationType.GERAL],
          },
          transaction,
        ),
        this.sumStock(
          InputStockModel,
          {
            tipos: [OperationType.INDIVIDUAL],
          },
          transaction,
        ),

        this.sumStock(
          MedicineStockModel,
          {
            tipos: [OperationType.CARRINHO_EMERGENCIA],
          },
          transaction,
        ),
        this.sumStock(
          MedicineStockModel,
          {
            tipos: [OperationType.CARRINHO_PSICOTROPICOS],
          },
          transaction,
        ),

        this.sumStock(
          InputStockModel,
          {
            tipos: [OperationType.CARRINHO_EMERGENCIA],
          },
          transaction,
        ),
        this.sumStock(
          InputStockModel,
          {
            tipos: [OperationType.CARRINHO_PSICOTROPICOS],
          },
          transaction,
        ),
      ]);

      return {
        medicamentos_geral: medicamentosGeral,
        medicamentos_individual: medicamentosIndividual,
        insumos_geral: insumosGeral,
        insumos_individual: insumosIndividual,

        carrinho_emergencia_medicamentos: carrinhoEmergenciaMedicamentos,
        carrinho_psicotropicos_medicamentos: carrinhoPsicotropicosMedicamentos,

        carrinho_emergencia_insumos: carrinhoEmergenciaInsumos,
        carrinho_psicotropicos_insumos: carrinhoPsicotropicosInsumos,
      };
    }

    const config = SECTOR_CONFIG[setor];

    for (const [group, tipos] of Object.entries(config.medicines)) {
      baseResult[group as StockGroup] = await this.sumStock(
        MedicineStockModel,
        {
          setor,
          tipos,
        },
        transaction,
      );
    }

    for (const [group, tipos] of Object.entries(config.inputs)) {
      baseResult[group as StockGroup] = await this.sumStock(
        InputStockModel,
        {
          setor,
          tipos,
        },
        transaction,
      );
    }

    return baseResult;
  }

  async findMedicineStockById(id: number, transaction?: Transaction) {
    return MedicineStockModel.findByPk(id, { transaction });
  }

  async getDaysForReplacementForNursing(
    medicamento_id: number,
    casela_id: number,
    transaction?: Transaction,
  ): Promise<number | null> {
    const row = await MedicineStockModel.findOne({
      where: {
        medicamento_id,
        casela_id,
        setor: 'enfermagem',
        dias_para_repor: { [Op.ne]: null },
      },
      attributes: ['dias_para_repor'],
      order: [['updatedAt', 'DESC']],
      transaction,
    });
    const value = row?.dias_para_repor;
    return value != null ? Number(value) : null;
  }

  async removeIndividualMedicine(estoqueId: number, transaction?: Transaction) {
    await MedicineStockModel.update(
      {
        casela_id: null,
        tipo: 'geral',
        setor: SectorType.FARMACIA,
      },
      {
        where: { id: estoqueId },
        transaction,
      },
    );

    const updated = await MedicineStockModel.findByPk(estoqueId, {
      transaction,
    });
    return {
      message: 'Medicamento removido do estoque individual',
      data: updated ? updated.get({ plain: true }) : null,
    };
  }

  async removeIndividualInput(estoqueId: number, transaction?: Transaction) {
    await InputStockModel.update(
      {
        casela_id: null,
        tipo: 'geral',
        setor: SectorType.FARMACIA,
      },
      {
        where: { id: estoqueId },
        transaction,
      },
    );

    const updated = await InputStockModel.findByPk(estoqueId, { transaction });
    return {
      message: 'Insumo removido do estoque individual',
      data: updated ? updated.get({ plain: true }) : null,
    };
  }

  async suspendIndividualMedicine(
    estoque_id: number,
    transaction?: Transaction,
  ) {
    await MedicineStockModel.update(
      {
        status: StockItemStatus.SUSPENSO,
        suspended_at: new Date(),
      },
      {
        where: { id: estoque_id },
        transaction,
      },
    );

    const updated = await MedicineStockModel.findByPk(estoque_id, {
      transaction,
    });
    return {
      message: 'Medicamento suspenso com sucesso',
      data: updated ? updated.get({ plain: true }) : null,
    };
  }

  async resumeIndividualMedicine(
    estoque_id: number,
    transaction?: Transaction,
  ) {
    await MedicineStockModel.update(
      {
        status: StockItemStatus.ATIVO,
        suspended_at: null,
      },
      {
        where: { id: estoque_id },
        transaction,
      },
    );

    const updated = await MedicineStockModel.findByPk(estoque_id, {
      transaction,
    });
    return {
      message: 'Medicamento retomado com sucesso',
      data: updated ? updated.get({ plain: true }) : null,
    };
  }

  async findInputStockById(id: number, transaction?: Transaction) {
    return InputStockModel.findByPk(id, { transaction });
  }

  async updateStockItem(
    estoqueId: number,
    tipo: ItemType,
    data: {
      quantidade?: number;
      armario_id?: number | null;
      gaveta_id?: number | null;
      validade?: Date | null;
      origem?: string | null;
      setor?: string;
      lote?: string | null;
      casela_id?: number | null;
      tipo?: string;
      preco?: number | null;
      observacao?: string | null;
      dias_para_repor?: number | null;
    },
    transaction?: Transaction,
  ) {
    if (tipo === ItemType.MEDICAMENTO) {
      const stock = await this.findMedicineStockById(estoqueId, transaction);
      if (!stock) {
        throw new Error('Item de estoque não encontrado');
      }

      const updateData: Partial<MedicineStockAttributes> = {};

      if ('quantidade' in data) updateData.quantidade = data.quantidade;
      if ('armario_id' in data) updateData.armario_id = data.armario_id ?? null;
      if ('gaveta_id' in data) updateData.gaveta_id = data.gaveta_id ?? null;
      if ('validade' in data) updateData.validade = data.validade ?? undefined;
      if ('origem' in data) updateData.origem = data.origem ?? null;
      if ('setor' in data) updateData.setor = data.setor;
      if ('lote' in data) updateData.lote = data.lote ?? null;
      if ('casela_id' in data) updateData.casela_id = data.casela_id ?? null;
      if ('observacao' in data) updateData.observacao = data.observacao ?? null;
      if ('dias_para_repor' in data)
        updateData.dias_para_repor = data.dias_para_repor ?? null;
      if ('tipo' in data) updateData.tipo = data.tipo;

      if (updateData.armario_id != null && updateData.gaveta_id != null) {
        throw new Error(
          'Não é permitido preencher armário e gaveta ao mesmo tempo',
        );
      }

      if (
        updateData.dias_para_repor != null &&
        updateData.dias_para_repor < 0
      ) {
        throw new Error('Dias para repor não pode ser negativo');
      }

      if (updateData.quantidade != null && updateData.quantidade < 1) {
        throw new Error('A quantidade não pode ser menor que 1');
      }

      if (
        updateData.casela_id != null &&
        updateData.tipo !== OperationType.INDIVIDUAL
      ) {
        throw new Error('A casela só pode ser preenchida para tipo individual');
      }

      if ('validade' in data && updateData.validade == null) {
        throw new Error('A data de validade é obrigatória');
      }

      if (updateData.origem != null && updateData.origem.trim() === '') {
        throw new Error('A origem não pode ser vazia');
      }

      if (updateData.setor != null && updateData.setor.trim() === '') {
        throw new Error('O setor não pode ser vazio');
      }

      if (updateData.tipo != null && updateData.tipo.trim() === '') {
        throw new Error('O tipo não pode ser vazio');
      }

      await MedicineStockModel.update(updateData, {
        where: { id: estoqueId },
        transaction,
      });
      const updated = await this.findMedicineStockById(estoqueId, transaction);
      return {
        message: 'Item de estoque atualizado com sucesso',
        data: updated ? updated.get({ plain: true }) : null,
      };
    } else {
      const stock = await this.findInputStockById(estoqueId, transaction);
      if (!stock) {
        throw new Error('Item de estoque não encontrado');
      }

      const updateData: Partial<InputStockAttributes> = {};

      if ('quantidade' in data) updateData.quantidade = data.quantidade;
      if ('armario_id' in data) updateData.armario_id = data.armario_id ?? null;
      if ('gaveta_id' in data) updateData.gaveta_id = data.gaveta_id ?? null;
      if ('validade' in data) updateData.validade = data.validade ?? undefined;
      if ('setor' in data) updateData.setor = data.setor;
      if ('lote' in data) updateData.lote = data.lote ?? null;
      if ('casela_id' in data) updateData.casela_id = data.casela_id ?? null;
      if ('observacao' in data) updateData.observacao = data.observacao ?? null;
      if ('dias_para_repor' in data)
        updateData.dias_para_repor = data.dias_para_repor ?? null;
      if ('tipo' in data) updateData.tipo = data.tipo;

      if (updateData.armario_id != null && updateData.gaveta_id != null) {
        throw new Error(
          'Não é permitido preencher armário e gaveta ao mesmo tempo',
        );
      }

      if (
        updateData.dias_para_repor != null &&
        updateData.dias_para_repor < 0
      ) {
        throw new Error('Dias para repor não pode ser negativo');
      }

      if (updateData.quantidade != null && updateData.quantidade < 1) {
        throw new Error('A quantidade não pode ser menor que 1');
      }

      if (
        updateData.casela_id != null &&
        updateData.tipo !== OperationType.INDIVIDUAL
      ) {
        throw new Error('A casela só pode ser preenchida para tipo individual');
      }

      if ('validade' in data && updateData.validade == null) {
        throw new Error('A data de validade é obrigatória');
      }

      if (updateData.setor != null && updateData.setor.trim() === '') {
        throw new Error('O setor não pode ser vazio');
      }

      if (updateData.tipo != null && updateData.tipo.trim() === '') {
        throw new Error('O tipo não pode ser vazio');
      }

      await InputStockModel.update(updateData, {
        where: { id: estoqueId },
        transaction,
      });
      const updated = await this.findInputStockById(estoqueId, transaction);
      return {
        message: 'Item de estoque atualizado com sucesso',
        data: updated ? updated.get({ plain: true }) : null,
      };
    }
  }

  async deleteStockItem(
    estoqueId: number,
    tipo: ItemType,
    transaction?: Transaction,
  ) {
    if (tipo === ItemType.MEDICAMENTO) {
      const stock = await this.findMedicineStockById(estoqueId, transaction);
      if (!stock) {
        throw new Error('Item de estoque não encontrado');
      }

      const deleted = stock.get({ plain: true }) as unknown as Record<
        string,
        unknown
      >;
      await MedicineStockModel.destroy({
        where: { id: estoqueId },
        transaction,
      });
      return {
        message: 'Item de estoque removido com sucesso',
        data: deleted,
      };
    } else {
      const stock = await this.findInputStockById(estoqueId, transaction);
      if (!stock) {
        throw new Error('Item de estoque não encontrado');
      }

      const deleted = stock.get({ plain: true }) as unknown as Record<
        string,
        unknown
      >;
      await InputStockModel.destroy({ where: { id: estoqueId }, transaction });
      return {
        message: 'Item de estoque removido com sucesso',
        data: deleted,
      };
    }
  }

  async suspendIndividualInput(estoque_id: number, transaction?: Transaction) {
    await InputStockModel.update(
      {
        status: StockItemStatus.SUSPENSO,
        suspended_at: new Date(),
      },
      {
        where: { id: estoque_id },
        transaction,
      },
    );

    const updated = await InputStockModel.findByPk(estoque_id, { transaction });
    return {
      message: 'Insumo suspenso com sucesso',
      data: updated ? updated.get({ plain: true }) : null,
    };
  }

  async resumeIndividualInput(estoque_id: number, transaction?: Transaction) {
    await InputStockModel.update(
      {
        status: StockItemStatus.ATIVO,
        suspended_at: null,
      },
      {
        where: { id: estoque_id },
        transaction,
      },
    );

    const updated = await InputStockModel.findByPk(estoque_id, { transaction });
    return {
      message: 'Insumo retomado com sucesso',
      data: updated ? updated.get({ plain: true }) : null,
    };
  }

  async transferMedicineSector(
    estoqueId: number,
    setor: 'farmacia' | 'enfermagem',
    quantidade: number,
    bypassCasela: boolean,
    casela_id: number,
    observacao?: string | null,
    dias_para_repor?: number | null,
    transaction?: Transaction,
  ) {
    const stock = await MedicineStockModel.findByPk(estoqueId, { transaction });

    if (!stock) {
      throw new Error('Estoque não encontrado');
    }

    if (!casela_id && !bypassCasela) {
      throw new Error('Casela é obrigatória para transferência de setor');
    }

    if (!quantidade || quantidade <= 0) {
      throw new Error('Quantidade inválida, deve ser um valor positivo');
    }

    if (quantidade > stock.quantidade) {
      throw new Error(`Quantidade não pode ser maior que ${stock.quantidade}`);
    }

    if (stock.quantidade === 0) {
      throw new Error('Não há estoque disponível para transferir');
    }

    if (!stock.origem) {
      throw new Error('Origem é obrigatória para medicamentos');
    }

    if (!casela_id && dias_para_repor != null) {
      throw new Error(
        'Dias para reposição só pode ser definido para estoque individual',
      );
    }

    if (dias_para_repor && (isNaN(dias_para_repor) || dias_para_repor < 0)) {
      throw new Error('Dias para repor deve ser um número positivo ou zero');
    }

    const finalCaselaId = bypassCasela ? null : casela_id;
    const finalDetails = bypassCasela
      ? 'para uso geral'
      : (observacao ?? stock.observacao);
    const finalStockType = bypassCasela
      ? OperationType.GERAL
      : OperationType.INDIVIDUAL;

    const existing = await MedicineStockModel.findOne({
      where: {
        medicamento_id: stock.medicamento_id,
        casela_id: finalCaselaId,
        validade: stock.validade,
        setor,
        lote: stock.lote ?? null,
        tipo: finalStockType,
      },
      transaction,
    });

    if (existing) {
      existing.quantidade += quantidade;

      if (observacao != null) {
        existing.observacao = observacao;
      }

      if (dias_para_repor != null) {
        existing.dias_para_repor = dias_para_repor;
      }

      existing.ultima_reposicao = getTodayAtNoonBrazil();

      await existing.save({ transaction });
    } else {
      const stockTenantId = stock.tenant_id;
      if (stockTenantId == null) {
        throw new Error('Tenant não identificado no registro de estoque');
      }
      await MedicineStockModel.create(
        {
          tenant_id: stockTenantId,
          medicamento_id: stock.medicamento_id,
          casela_id: finalCaselaId,
          armario_id: stock.armario_id,
          gaveta_id: stock.gaveta_id,
          validade: stock.validade,
          quantidade,
          origem: stock.origem,
          tipo: finalStockType,
          setor,
          lote: stock.lote,
          status: stock.status,
          observacao: finalDetails,
          dias_para_repor: dias_para_repor ?? null,
          ultima_reposicao: getTodayAtNoonBrazil(),
        },
        { transaction },
      );
    }

    await stock.update(
      { quantidade: stock.quantidade - quantidade },
      { transaction },
    );

    await stock.reload({ transaction });
    const target = existing
      ? await MedicineStockModel.findByPk(existing.id, { transaction })
      : await MedicineStockModel.findOne({
          where: {
            medicamento_id: stock.medicamento_id,
            casela_id: finalCaselaId,
            validade: stock.validade,
            setor,
            lote: stock.lote ?? null,
            tipo: finalStockType,
          },
          transaction,
        });
    return {
      message: 'Medicamento transferido de setor com sucesso',
      data: {
        source: stock.get({ plain: true }),
        target: target ? target.get({ plain: true }) : null,
      },
    };
  }

  async transferInputSector(
    estoqueId: number,
    setor: 'farmacia' | 'enfermagem',
    quantidade: number,
    casela_id?: number | null,
    destino?: string | null,
    observacao?: string | null,
    dias_para_repor?: number | null,
    transaction?: Transaction,
  ) {
    const stock = await InputStockModel.findByPk(estoqueId, { transaction });

    if (!stock) {
      throw new Error('Estoque não encontrado');
    }

    const hasDestino = destino != null && destino.trim() !== '';

    if (hasDestino && casela_id) {
      throw new Error('Destino e casela não podem ser informados juntos');
    }

    if (!quantidade || quantidade <= 0) {
      throw new Error('Quantidade inválida, deve ser um valor positivo');
    }

    if (stock.quantidade === 0) {
      throw new Error('Não há estoque disponível para transferir');
    }

    if (quantidade > stock.quantidade) {
      throw new Error(`Quantidade não pode ser maior que ${stock.quantidade}`);
    }

    if (!casela_id && dias_para_repor != null) {
      throw new Error(
        'Dias para reposição só pode ser definido para estoque individual',
      );
    }

    if (dias_para_repor && (isNaN(dias_para_repor) || dias_para_repor < 0)) {
      throw new Error('Dias para repor deve ser um número positivo ou zero');
    }

    const finalTipo = hasDestino
      ? OperationType.GERAL
      : OperationType.INDIVIDUAL;

    const existing = await InputStockModel.findOne({
      where: {
        insumo_id: stock.insumo_id,
        casela_id: casela_id,
        validade: stock.validade,
        setor,
        lote: stock.lote ?? null,
        tipo: finalTipo,
        destino: hasDestino ? destino : null,
      },
      transaction,
    });

    if (existing) {
      existing.quantidade += quantidade;

      if (observacao != null) {
        existing.observacao = observacao;
      }

      if (dias_para_repor != null) {
        existing.dias_para_repor = dias_para_repor;
      }

      existing.ultima_reposicao = getTodayAtNoonBrazil();

      await existing.save({ transaction });
    } else {
      const stockTenantId = stock.tenant_id;
      if (stockTenantId == null) {
        throw new Error('Tenant não identificado no registro de estoque');
      }
      await InputStockModel.create(
        {
          tenant_id: stockTenantId,
          insumo_id: stock.insumo_id,
          casela_id: casela_id,
          armario_id: stock.armario_id,
          gaveta_id: stock.gaveta_id,
          validade: stock.validade,
          quantidade,
          tipo: finalTipo,
          setor,
          lote: stock.lote,
          status: stock.status,
          destino: hasDestino ? destino : null,
          observacao: observacao ?? stock.observacao,
          dias_para_repor: dias_para_repor ?? null,
          ultima_reposicao: getTodayAtNoonBrazil(),
        },
        { transaction },
      );
    }

    await stock.update(
      { quantidade: stock.quantidade - quantidade },
      { transaction },
    );

    await stock.reload({ transaction });
    const target = existing
      ? await InputStockModel.findByPk(existing.id, { transaction })
      : await InputStockModel.findOne({
          where: {
            insumo_id: stock.insumo_id,
            casela_id: casela_id,
            validade: stock.validade,
            setor,
            lote: stock.lote ?? null,
            tipo: finalTipo,
            destino: hasDestino ? destino : null,
          },
          transaction,
        });
    return {
      message: 'Insumo transferido de setor com sucesso',
      data: {
        source: stock.get({ plain: true }),
        target: target ? target.get({ plain: true }) : null,
      },
    };
  }

  async getExpiringItems(
    days: number,
    page: number = 1,
    limit: number = 50,
    transaction?: Transaction,
  ): Promise<{ data: ExpiringStockItem[]; total: number; hasNext: boolean }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + Math.min(365, Math.max(1, days)));

    const [medRows, inpRows] = await Promise.all([
      MedicineStockModel.findAll({
        where: {
          quantidade: { [Op.gt]: 0 },
          validade: { [Op.between]: [today, endDate] },
        },
        include: [
          {
            model: MedicineModel,
            as: 'MedicineModel',
            attributes: [
              'nome',
              'principio_ativo',
              'dosagem',
              'unidade_medida',
            ],
          },
          {
            model: ResidentModel,
            as: 'ResidentModel',
            attributes: ['nome'],
            required: false,
          },
        ],
        order: [['validade', 'ASC']],
        limit: 500,
        transaction,
        raw: false,
      }),
      InputStockModel.findAll({
        where: {
          quantidade: { [Op.gt]: 0 },
          validade: { [Op.between]: [today, endDate] },
        },
        include: [
          {
            model: InputModel,
            as: 'InputModel',
            attributes: ['nome', 'descricao'],
          },
          {
            model: ResidentModel,
            as: 'ResidentModel',
            attributes: ['nome'],
            required: false,
          },
        ],
        order: [['validade', 'ASC']],
        limit: 500,
        transaction,
        raw: false,
      }),
    ]);

    type ExpiringRowPlain = Record<string, unknown> & {
      id?: number;
      medicamento_id?: number;
      insumo_id?: number;
      validade?: string | Date;
      quantidade?: number;
      lote?: string | null;
      setor?: string | null;
      MedicineModel?: {
        nome?: string;
        principio_ativo?: string;
        dosagem?: string;
        unidade_medida?: string;
      };
      InputModel?: { nome?: string; descricao?: string | null };
      ResidentModel?: { nome?: string };
    };
    type ExpiringRow =
      | { get?(opts: { plain: true }): ExpiringRowPlain }
      | ExpiringRowPlain;
    const toItem = (
      r: ExpiringRow,
      tipo: 'medicamento' | 'insumo',
    ): ExpiringStockItem => {
      const plain: ExpiringRowPlain =
        typeof (r as { get?: (o: { plain: true }) => ExpiringRowPlain }).get ===
        'function'
          ? (r as { get(o: { plain: true }): ExpiringRowPlain }).get({
              plain: true,
            })
          : (r as ExpiringRowPlain);
      const validade = plain.validade ? new Date(plain.validade) : null;
      const dias = validade
        ? Math.ceil((validade.getTime() - today.getTime()) / 86400000)
        : 0;
      if (tipo === 'medicamento') {
        return {
          tipo_item: 'medicamento' as const,
          item_id: Number(plain.medicamento_id) || 0,
          estoque_id: Number(plain.id) || 0,
          nome: plain.MedicineModel?.nome ?? '-',
          principio_ativo: plain.MedicineModel?.principio_ativo ?? null,
          dosagem: plain.MedicineModel?.dosagem ?? null,
          unidade_medida: plain.MedicineModel?.unidade_medida ?? null,
          descricao: null,
          validade: validade ? formatDateToPtBr(validade) : null,
          quantidade: Number(plain.quantidade) || 0,
          lote: plain.lote ?? null,
          setor: plain.setor ?? null,
          paciente: plain.ResidentModel?.nome ?? null,
          dias_para_vencer: dias,
        };
      }
      return {
        tipo_item: 'insumo' as const,
        item_id: Number(plain.insumo_id) || 0,
        estoque_id: Number(plain.id) || 0,
        nome: plain.InputModel?.nome ?? '-',
        principio_ativo: null,
        descricao: plain.InputModel?.descricao ?? null,
        validade: validade ? formatDateToPtBr(validade) : null,
        quantidade: Number(plain.quantidade) || 0,
        lote: plain.lote ?? null,
        setor: plain.setor ?? null,
        paciente: plain.ResidentModel?.nome ?? null,
        dias_para_vencer: dias,
      };
    };

    const all = [
      ...medRows.map(r => toItem(r, 'medicamento')),
      ...inpRows.map(r => toItem(r, 'insumo')),
    ].sort((a, b) => (a.dias_para_vencer ?? 0) - (b.dias_para_vencer ?? 0));

    const total = all.length;
    const start = (page - 1) * limit;
    const data = all.slice(start, start + limit);

    return {
      data,
      total,
      hasNext: start + data.length < total,
    };
  }

  async getAlertCounts(
    transaction?: Transaction,
    expiringDays: number = 45,
  ): Promise<{
    noStock: number;
    belowMin: number;
    nearMin: number;
    expired: number;
    expiringSoon: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inDays = new Date(today);
    inDays.setDate(inDays.getDate() + Math.min(365, Math.max(1, expiringDays)));

    const [
      noStockMed,
      noStockInp,
      belowMinMed,
      belowMinInp,
      nearMinMed,
      nearMinInp,
      expiredMed,
      expiredInp,
      expiringMed,
      expiringInp,
    ] = await Promise.all([
      MedicineStockModel.count({ where: { quantidade: 0 }, transaction }),
      InputStockModel.count({ where: { quantidade: 0 }, transaction }),
      MedicineStockModel.count({
        include: [
          {
            model: MedicineModel,
            as: 'MedicineModel',
            attributes: [],
            required: true,
          },
        ],
        where: {
          quantidade: {
            [Op.gte]: 0,
            [Op.lt]: sequelize.col('MedicineModel.estoque_minimo'),
          },
        },
        transaction,
      }),
      InputStockModel.count({
        include: [
          {
            model: InputModel,
            as: 'InputModel',
            attributes: [],
            required: true,
          },
        ],
        where: {
          quantidade: {
            [Op.gte]: 0,
            [Op.lt]: sequelize.col('InputModel.estoque_minimo'),
          },
        },
        transaction,
      }),
      MedicineStockModel.count({
        include: [
          {
            model: MedicineModel,
            as: 'MedicineModel',
            attributes: [],
            required: true,
          },
        ],
        where: {
          quantidade: {
            [Op.gt]: sequelize.col('MedicineModel.estoque_minimo'),
            [Op.lte]: sequelize.literal(
              '("MedicineModel"."estoque_minimo" * 1.2)',
            ),
          },
        },
        transaction,
      }),
      InputStockModel.count({
        include: [
          {
            model: InputModel,
            as: 'InputModel',
            attributes: [],
            required: true,
          },
        ],
        where: {
          quantidade: {
            [Op.gt]: sequelize.col('InputModel.estoque_minimo'),
            [Op.lte]: sequelize.literal(
              '("InputModel"."estoque_minimo" * 1.2)',
            ),
          },
        },
        transaction,
      }),
      MedicineStockModel.count({
        where: {
          quantidade: { [Op.gt]: 0 },
          validade: { [Op.lt]: sequelize.literal('CURRENT_DATE') },
        },
        transaction,
      }),
      InputStockModel.count({
        where: {
          quantidade: { [Op.gt]: 0 },
          validade: { [Op.lt]: sequelize.literal('CURRENT_DATE') },
        },
        transaction,
      }),
      MedicineStockModel.count({
        where: {
          quantidade: { [Op.gt]: 0 },
          validade: {
            [Op.and]: [
              { [Op.gte]: sequelize.literal('CURRENT_DATE') },
              {
                [Op.lte]: sequelize.literal(
                  'CURRENT_DATE + ' + Math.min(365, Math.max(1, expiringDays)),
                ),
              },
            ],
          },
        },
        transaction,
      }),
      InputStockModel.count({
        where: {
          quantidade: { [Op.gt]: 0 },
          validade: {
            [Op.and]: [
              { [Op.gte]: sequelize.literal('CURRENT_DATE') },
              {
                [Op.lte]: sequelize.literal(
                  'CURRENT_DATE + ' + Math.min(365, Math.max(1, expiringDays)),
                ),
              },
            ],
          },
        },
        transaction,
      }),
    ]);

    return {
      noStock: noStockMed + noStockInp,
      belowMin: belowMinMed + belowMinInp,
      nearMin: nearMinMed + nearMinInp,
      expired: expiredMed + expiredInp,
      expiringSoon: expiringMed + expiringInp,
    };
  }
}
