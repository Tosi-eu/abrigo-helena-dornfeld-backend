import { MedicineStock, InputStock } from '../../../core/domain/estoque';
import MedicineStockModel, {
  MedicineStockAttributes,
} from '../models/estoque-medicamento.model';
import InputStockModel, {
  InputStockAttributes,
} from '../models/estoque-insumo.model';
import { Op, fn, col } from 'sequelize';
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
import { formatDateToPtBr } from '../../helpers/date.helper';
import { SECTOR_CONFIG, StockGroup, StockQueryResult } from '../../types/estoque.types';

interface StockModel {
  sum(
    field: string,
    options?: {
      where?: Record<string, unknown>;
    },
  ): Promise<number | null>;
}

export class StockRepository {
  async createMedicineStockIn(data: MedicineStock) {
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
      });

      if (existing) {
        existing.quantidade += data.quantidade;
        await existing.save();
        return { message: 'Quantidade somada ao estoque existente.' };
      }

      await MedicineStockModel.create({
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
      });

      return { message: 'Entrada de medicamento registrada.' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(message);
    }
  }

  async createInputStockIn(data: InputStock) {
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
    });

    if (data.casela_id && data.tipo !== OperationType.INDIVIDUAL) {
      throw new Error('Casela só pode ser usada para insumo individual');
    }

    if (existing) {
      existing.quantidade += data.quantidade;
      await existing.save();
      return { message: 'Quantidade somada ao estoque existente.' };
    }

    await InputStockModel.create({
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
    });

    return { message: 'Entrada de insumo registrada.' };
  }

  async createStockOut(
    estoqueId: number,
    tipoItem: ItemType,
    quantidade: number,
  ) {
    if (tipoItem === 'medicamento') {
      const register = await MedicineStockModel.findByPk(estoqueId);

      if (!register) throw new Error('register de medicamento não encontrado.');

      if (register.quantidade < quantidade)
        throw new Error('Quantidade insuficiente.');

      if (register?.status === StockItemStatus.SUSPENSO) {
        throw new Error('Medicamento suspenso não pode ser movimentado');
      }

      register.quantidade -= quantidade;
      await register.save();
      return { message: 'Saída de medicamento realizada.' };
    } else {
      const register = await InputStockModel.findByPk(estoqueId);
      if (!register) throw new Error('register de insumo não encontrado.');
      if (register.quantidade < quantidade)
        throw new Error('Quantidade insuficiente.');

      if (register?.status === StockItemStatus.SUSPENSO) {
        throw new Error('Insumo suspenso não pode ser movimentado');
      }

      register.quantidade -= quantidade;
      await register.save();
      return { message: 'Saída de insumo realizada.' };
    }
  }

  async listStockItems(params: QueryPaginationParams) {
    const { filter, type, page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    if (type === 'armarios') {
      const cabinets = await CabinetModel.findAll({
        order: [['num_armario', 'ASC']],
        attributes: ['num_armario'],
      });

      const cabinetIds = cabinets.map(c => c.num_armario);

      const medicineTotals = await MedicineStockModel.findAll({
        attributes: ['armario_id', [fn('SUM', col('quantidade')), 'total']],
        where: {
          armario_id: { [Op.in]: cabinetIds },
        },
        group: ['armario_id'],
        raw: true,
      });

      const inputTotals = await InputStockModel.findAll({
        attributes: ['armario_id', [fn('SUM', col('quantidade')), 'total']],
        where: {
          armario_id: { [Op.in]: cabinetIds },
        },
        group: ['armario_id'],
        raw: true,
      });

      const medicineMap = new Map(
        medicineTotals.map((item: any) => [
          item.armario_id,
          Number(item.total || 0),
        ]),
      );
      const inputMap = new Map(
        inputTotals.map((item: any) => [
          item.armario_id,
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
      });

      const drawerIds = drawers.map(d => d.num_gaveta);

      const medicineTotals = await MedicineStockModel.findAll({
        attributes: ['gaveta_id', [fn('SUM', col('quantidade')), 'total']],
        where: {
          gaveta_id: { [Op.in]: drawerIds },
        },
        group: ['gaveta_id'],
        raw: true,
      });

      const inputTotals = await InputStockModel.findAll({
        attributes: ['gaveta_id', [fn('SUM', col('quantidade')), 'total']],
        where: {
          gaveta_id: { [Op.in]: drawerIds },
        },
        group: ['gaveta_id'],
        raw: true,
      });

      const medicineMap = new Map(
        medicineTotals.map((item: any) => [
          item.gaveta_id,
          Number(item.total || 0),
        ]),
      );
      const inputMap = new Map(
        inputTotals.map((item: any) => [
          item.gaveta_id,
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

      const baseWhere: any = {};

      switch (filter) {
        case 'belowMin':
          baseWhere.quantidade = { [Op.gt]: 0 };
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
      const medicineWhere: any = { ...whereCondition };

      if (filter === 'belowMin') {
        medicineWhere.quantidade = { [Op.gt]: 0 };
      }

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

      const medicineIncludeWhere: any = {};
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
            attributes: ['id', 'nome', 'principio_ativo', 'dosagem', 'unidade_medida', 'estoque_minimo'],
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
      });

      for (const stock of medicineStocks) {
        const plainStock = stock.get({ plain: true }) as any;
        const medicine = plainStock.MedicineModel as MedicineModel | undefined;
        const resident = plainStock.ResidentModel as ResidentModel | undefined;

        if (filter === 'belowMin') {
          const minStock = medicine?.estoque_minimo ?? 0;
          if (stock.quantidade > minStock) continue;
        }

        if (filter === 'nearMin') {
          const minStock = medicine?.estoque_minimo ?? 0;
          if (minStock === 0) continue;

          const upperLimit = minStock * 1.35;
          if (
            stock.quantidade < minStock ||
            stock.quantidade > upperLimit
          ) {
            continue;
          }
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
          destino: null,
        } as StockQueryResult);
      }
    }

    if ((!type || type === 'insumo') && shouldIncludeInputs) {
      const inputWhere: any = { ...whereCondition };

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

      const inputIncludeWhere: any = {};
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
      });

      for (const stock of inputStocks) {
        const plainStock = stock.get({ plain: true }) as any;
        const input = plainStock.InputModel as InputModel | undefined;
        const resident = plainStock.ResidentModel as ResidentModel | undefined;

        if (filter === StockFilterType.BELOW_MIN) {
          const minStock = input?.estoque_minimo ?? 0;
          if (stock.quantidade > minStock) continue;
        }

        if (filter === StockFilterType.NEAR_MIN) {
          const minStock = input?.estoque_minimo ?? 0;
          if (minStock === 0) continue;

          const upperLimit = minStock * 1.35;

          if (
            stock.quantidade < minStock ||
            stock.quantidade > upperLimit
          ) {
            continue;
          }
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

  private async sumStock(
    model: StockModel,
    options?: {
      setor?: SectorType;
      tipos?: OperationType[];
    },
  ): Promise<number> {
    const result = await model.sum('quantidade', {
      where: {
        ...(options?.setor && { setor: options.setor }),
        ...(options?.tipos && { tipo: { [Op.in]: options.tipos } }),
      },
    });
  
    return Number(result || 0);
  }  

  async getStockProportionBySector(
    setor?: SectorType,
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
        this.sumStock(MedicineStockModel, {
          tipos: [OperationType.GERAL],
        }),
        this.sumStock(MedicineStockModel, {
          tipos: [OperationType.INDIVIDUAL],
        }),
        this.sumStock(InputStockModel, {
          tipos: [OperationType.GERAL],
        }),
        this.sumStock(InputStockModel, {
          tipos: [OperationType.INDIVIDUAL],
        }),
  
        this.sumStock(MedicineStockModel, {
          tipos: [OperationType.CARRINHO_EMERGENCIA],
        }),
        this.sumStock(MedicineStockModel, {
          tipos: [OperationType.CARRINHO_PSICOTROPICOS],
        }),
  
        this.sumStock(InputStockModel, {
          tipos: [OperationType.CARRINHO_EMERGENCIA],
        }),
        this.sumStock(InputStockModel, {
          tipos: [OperationType.CARRINHO_PSICOTROPICOS],
        }),
      ]);
  
      return {
        medicamentos_geral: medicamentosGeral,
        medicamentos_individual: medicamentosIndividual,
        insumos_geral: insumosGeral,
        insumos_individual: insumosIndividual,
  
        carrinho_emergencia_medicamentos:
          carrinhoEmergenciaMedicamentos,
        carrinho_psicotropicos_medicamentos:
          carrinhoPsicotropicosMedicamentos,
  
        carrinho_emergencia_insumos:
          carrinhoEmergenciaInsumos,
        carrinho_psicotropicos_insumos:
          carrinhoPsicotropicosInsumos,
      };
    }
  
    const config = SECTOR_CONFIG[setor];
  
    for (const [group, tipos] of Object.entries(config.medicines)) {
      baseResult[group as StockGroup] =
        await this.sumStock(MedicineStockModel, {
          setor,
          tipos,
        });
    }
  
    for (const [group, tipos] of Object.entries(config.inputs)) {
      baseResult[group as StockGroup] =
        await this.sumStock(InputStockModel, {
          setor,
          tipos,
        });
    }
  
    return baseResult;
  }  
  
  async findMedicineStockById(id: number) {
    return MedicineStockModel.findByPk(id);
  }

  async removeIndividualMedicine(estoqueId: number) {
    await MedicineStockModel.update(
      {
        casela_id: null,
        tipo: 'geral',
        setor: SectorType.FARMACIA,
      },
      {
        where: { id: estoqueId },
      },
    );

    return {
      message: 'Medicamento removido do estoque individual',
    };
  }

  async removeIndividualInput(estoqueId: number) {
    await InputStockModel.update(
      {
        casela_id: null,
        tipo: 'geral',
        setor: SectorType.FARMACIA,
      },
      {
        where: { id: estoqueId },
      },
    );

    return {
      message: 'Insumo removido do estoque individual',
    };
  }

  async suspendIndividualMedicine(estoque_id: number) {
    await MedicineStockModel.update(
      {
        status: StockItemStatus.SUSPENSO,
        suspended_at: new Date(),
      },
      {
        where: { id: estoque_id },
      },
    );

    return {
      message: 'Medicamento suspenso com sucesso',
    };
  }

  async resumeIndividualMedicine(estoque_id: number) {
    await MedicineStockModel.update(
      {
        status: StockItemStatus.ATIVO,
        suspended_at: null,
      },
      {
        where: { id: estoque_id },
      },
    );

    return {
      message: 'Medicamento retomado com sucesso',
    };
  }

  async findInputStockById(id: number) {
    return InputStockModel.findByPk(id);
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
    },
  ) {
    if (tipo === ItemType.MEDICAMENTO) {
      const stock = await this.findMedicineStockById(estoqueId);
      if (!stock) {
        throw new Error('Item de estoque não encontrado');
      }

      const updateData: Partial<MedicineStockAttributes> = {};

      if ('quantidade' in data) updateData.quantidade = data.quantidade;
      if ('armario_id' in data) updateData.armario_id = data.armario_id ?? null;
      if ('gaveta_id' in data) updateData.gaveta_id = data.gaveta_id ?? null;
      if ('validade' in data) updateData.validade = data.validade;
      if ('origem' in data) updateData.origem = data.origem;
      if ('setor' in data) updateData.setor = data.setor;
      if ('lote' in data) updateData.lote = data.lote ?? null;
      if ('casela_id' in data) updateData.casela_id = data.casela_id ?? null;
      if (data.tipo) updateData.tipo = data.tipo;

      if (updateData.armario_id != null && updateData.gaveta_id != null) {
        throw new Error(
          'Não é permitido preencher armário e gaveta ao mesmo tempo',
        );
      }

      if (updateData.quantidade != null && updateData.quantidade < 1) {
        throw new Error('A quantidade não pode ser menor que 0');
      }

      if (
        updateData.casela_id != null &&
        updateData.tipo !== OperationType.INDIVIDUAL
      ) {
        throw new Error('A casela só pode ser preenchida para tipo individual');
      }

      if (updateData.validade == null) {
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

      await MedicineStockModel.update(updateData, { where: { id: estoqueId } });
    } else {
      const stock = await this.findInputStockById(estoqueId);
      if (!stock) {
        throw new Error('Item de estoque não encontrado');
      }

      const updateData: Partial<InputStockAttributes> = {};

      if ('quantidade' in data) updateData.quantidade = data.quantidade;
      if ('armario_id' in data) updateData.armario_id = data.armario_id ?? null;
      if ('gaveta_id' in data) updateData.gaveta_id = data.gaveta_id ?? null;
      if ('validade' in data) updateData.validade = data.validade as Date;
      if ('setor' in data) updateData.setor = data.setor;
      if ('lote' in data) updateData.lote = data.lote ?? null;
      if ('casela_id' in data) updateData.casela_id = data.casela_id ?? null;
      if (data.tipo != null && data.tipo !== '') {
        updateData.tipo = data.tipo;
      }

      if (updateData.armario_id != null && updateData.gaveta_id != null) {
        throw new Error(
          'Não é permitido preencher armário e gaveta ao mesmo tempo',
        );
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

      if (updateData.validade == null && !stock.validade) {
        throw new Error('A data de validade é obrigatória');
      }

      if (updateData.setor != null && updateData.setor.trim() === '') {
        throw new Error('O setor não pode ser vazio');
      }

      if (updateData.tipo != null && updateData.tipo.trim() === '') {
        throw new Error('O tipo não pode ser vazio');
      }
      await InputStockModel.update(updateData, { where: { id: estoqueId } });
    }

    return {
      message: 'Item de estoque atualizado com sucesso',
    };
  }

  async deleteStockItem(estoqueId: number, tipo: ItemType) {
    if (tipo === ItemType.MEDICAMENTO) {
      const stock = await this.findMedicineStockById(estoqueId);
      if (!stock) {
        throw new Error('Item de estoque não encontrado');
      }

      await MedicineStockModel.destroy({ where: { id: estoqueId } });
    } else {
      const stock = await this.findInputStockById(estoqueId);
      if (!stock) {
        throw new Error('Item de estoque não encontrado');
      }

      await InputStockModel.destroy({ where: { id: estoqueId } });
    }

    return {
      message: 'Item de estoque removido com sucesso',
    };
  }

  async suspendIndividualInput(estoque_id: number) {
    await InputStockModel.update(
      {
        status: StockItemStatus.SUSPENSO,
        suspended_at: new Date(),
      },
      {
        where: { id: estoque_id },
      },
    );

    return {
      message: 'Insumo suspenso com sucesso',
    };
  }

  async resumeIndividualInput(estoque_id: number) {
    await InputStockModel.update(
      {
        status: StockItemStatus.ATIVO,
        suspended_at: null,
      },
      {
        where: { id: estoque_id },
      },
    );

    return {
      message: 'Insumo retomado com sucesso',
    };
  }

  async transferMedicineSector(
      estoqueId: number,
      setor: 'farmacia' | 'enfermagem',
      quantidade: number,
      bypassCasela: boolean,
      casela_id: number,
      observacao?: string | null,
    ) {
      const stock = await MedicineStockModel.findByPk(estoqueId);

      if (!stock) {
        throw new Error('Estoque não encontrado');
      }
    
      if (!casela_id && !bypassCasela) {
        throw new Error('Casela é obrigatória para transferência de setor');
      }
    
      if (!quantidade || quantidade <= 0) {
        throw new Error('Quantidade inválida');
      }
    
      if (quantidade > stock.quantidade) {
        throw new Error(`Quantidade não pode ser maior que ${stock.quantidade}`);
      }
    
      if (!stock.origem) {
        throw new Error('Origem é obrigatória para medicamentos');
      }

      const finalCaselaId = bypassCasela ? null : casela_id;
      const finalDetails = bypassCasela
        ? 'para uso geral'
        : observacao ?? stock.observacao;
      const finalStockType = bypassCasela ? OperationType.GERAL : OperationType.INDIVIDUAL;
    
      const existing = await MedicineStockModel.findOne({
        where: {
          medicamento_id: stock.medicamento_id,
          casela_id: finalCaselaId,
          validade: stock.validade,
          setor,
          lote: stock.lote ?? null,
          tipo: stock.tipo
        },
      });
    
      if (existing) {
        existing.quantidade += quantidade;

        if (observacao != null) {
          existing.observacao = observacao;
        }

        await existing.save();
      } else {
        await MedicineStockModel.create({
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
        });
      }
    
      if (quantidade < stock.quantidade) {
        await stock.update({ quantidade: stock.quantidade - quantidade });
      } else {
        await stock.destroy();
      }
    
      return { message: 'Medicamento transferido de setor com sucesso' };
    }
  
  async transferInputSector(
    estoqueId: number,
    setor: 'farmacia' | 'enfermagem',
    quantidade: number,
    casela_id?: number | null,
    destino?: string | null,
    observacao?: string | null,
  ) {
    const stock = await InputStockModel.findByPk(estoqueId);
    if (!stock) {
      throw new Error('Estoque não encontrado');
    }

    const hasDestino = destino != null && destino.trim() !== '';
  
    if (hasDestino && casela_id) {
      throw new Error('Destino e casela não podem ser informados juntos');
    }
  
    if (!quantidade || quantidade <= 0) {
      throw new Error('Quantidade inválida');
    }
  
    if (quantidade > stock.quantidade) {
      throw new Error(`Quantidade não pode ser maior que ${stock.quantidade}`);
    }
  
    const existing = await InputStockModel.findOne({
      where: {
        insumo_id: stock.insumo_id,
        casela_id: casela_id,
        validade: stock.validade,
        setor,
        lote: stock.lote ?? null,
        tipo: stock.tipo,
        destino: hasDestino ? destino : null,
      },
    });
  
    if (existing) {
      existing.quantidade += quantidade;

      if (observacao != null) {
        existing.observacao = observacao;
      }

      await existing.save();
    } else {
      await InputStockModel.create({
        insumo_id: stock.insumo_id,
        casela_id: casela_id,
        armario_id: stock.armario_id,
        gaveta_id: stock.gaveta_id,
        validade: stock.validade,
        quantidade,
        tipo: hasDestino ? OperationType.GERAL : OperationType.INDIVIDUAL,
        setor,
        lote: stock.lote,
        status: stock.status,
        destino: hasDestino ? destino : null,
        observacao: observacao ?? stock.observacao,
      });
    }
  
    if (quantidade < stock.quantidade) {
      await stock.update({ quantidade: stock.quantidade - quantidade });
    } else {
      await stock.destroy();
    }
  
    return { message: 'Insumo transferido de setor com sucesso' };
  }

}
