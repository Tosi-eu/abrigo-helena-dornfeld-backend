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
import { StockQueryResult } from '../../types/estoque.types';

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
        preco: data.preco ?? null,
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
      preco: data.preco ?? null,
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
        attributes: [
          'armario_id',
          [fn('SUM', col('quantidade')), 'total'],
        ],
        where: {
          armario_id: { [Op.in]: cabinetIds },
        },
        group: ['armario_id'],
        raw: true,
      });

      const inputTotals = await InputStockModel.findAll({
        attributes: [
          'armario_id',
          [fn('SUM', col('quantidade')), 'total'],
        ],
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
        attributes: [
          'gaveta_id',
          [fn('SUM', col('quantidade')), 'total'],
        ],
        where: {
          gaveta_id: { [Op.in]: drawerIds },
        },
        group: ['gaveta_id'],
        raw: true,
      });

      const inputTotals = await InputStockModel.findAll({
        attributes: [
          'gaveta_id',
          [fn('SUM', col('quantidade')), 'total'],
        ],
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

      switch (filter) {
        case 'noStock':
          return { quantidade: 0 };
        case 'belowMin':
          return { quantidade: { [Op.gt]: 0 } };
        case 'expired':
          return {
            quantidade: { [Op.gt]: 0 },
            validade: { [Op.lt]: today },
          };
        case 'expiringSoon':
          return {
            quantidade: { [Op.gt]: 0 },
            validade: { [Op.between]: [today, in45Days] },
          };
        default:
          return {};
      }
    };

    const whereCondition = buildWhereCondition();
    const results: StockQueryResult[] = [];

    if (!type || type === 'medicamento') {
      const medicineWhere: any = { ...whereCondition };
      
      if (filter === 'belowMin') {
        medicineWhere.quantidade = { [Op.gt]: 0 };
      }

      const medicineStocks = await MedicineStockModel.findAll({
        where: medicineWhere,
        include: [
          {
            model: MedicineModel,
            attributes: ['id', 'nome', 'principio_ativo', 'estoque_minimo'],
            required: true,
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
          const estoqueMinimo = medicine?.estoque_minimo || 0;
          if (stock.quantidade > estoqueMinimo) continue;
        }

        results.push({
          tipo_item: 'medicamento',
          estoque_id: stock.id,
          item_id: medicine?.id,
          nome: medicine?.nome,
          principio_ativo: medicine?.principio_ativo || null,
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
          preco: stock.preco || null,
        } as StockQueryResult);
      }
    }

    if (!type || type === 'insumo') {
      const inputWhere: any = { ...whereCondition };
      
      if (filter === 'belowMin') {
        inputWhere.quantidade = { [Op.gt]: 0 };
      }

      const inputStocks = await InputStockModel.findAll({
        where: inputWhere,
        include: [
          {
            model: InputModel,
            attributes: ['id', 'nome', 'descricao', 'estoque_minimo'],
            required: true,
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
          const estoqueMinimo = input?.estoque_minimo || 0;
          if (stock.quantidade > estoqueMinimo) continue;
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
          lote: stock.lote || null,
          observacao: null,
          preco: stock.preco || null,
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

  async getStockProportionBySector(setor: 'farmacia' | 'enfermagem'): Promise<{
    medicamentos_geral: number;
    medicamentos_individual: number;
    insumos: number;
    carrinho_medicamentos: number;
    carrinho_insumos: number;
  }> {
    if (setor === SectorType.FARMACIA) {
      const medicamentosGeral = await MedicineStockModel.sum('quantidade', {
        where: {
          tipo: OperationType.GERAL,
          setor: SectorType.FARMACIA,
        },
      });

      const medicamentosIndividual = await MedicineStockModel.sum(
        'quantidade',
        {
          where: {
            tipo: OperationType.INDIVIDUAL,
            setor: SectorType.FARMACIA,
          },
        },
      );

      const insumos = await InputStockModel.sum('quantidade', {
        where: {
          tipo: OperationType.GERAL,
          setor: SectorType.FARMACIA,
        },
      });

      return {
        medicamentos_geral: Number(medicamentosGeral || 0),
        medicamentos_individual: Number(medicamentosIndividual || 0),
        insumos: Number(insumos || 0),
        carrinho_medicamentos: 0,
        carrinho_insumos: 0,
      };
    }

    const medicamentosGeral = await MedicineStockModel.sum('quantidade', {
      where: {
        tipo: OperationType.GERAL,
          setor: SectorType.ENFERMAGEM,
      },
    });

    const medicamentosIndividual = await MedicineStockModel.sum('quantidade', {
      where: {
        tipo: OperationType.INDIVIDUAL,
          setor: SectorType.ENFERMAGEM,
      },
    });

    const carrinhoMedicamentos = await MedicineStockModel.sum('quantidade', {
      where: {
        tipo: OperationType.CARRINHO,
          setor: SectorType.ENFERMAGEM,
      },
    });

    const insumos = await InputStockModel.sum('quantidade', {
      where: {
        tipo: OperationType.GERAL,
          setor: SectorType.ENFERMAGEM,
      },
    });

    const carrinhoInsumos = await InputStockModel.sum('quantidade', {
      where: {
        tipo: OperationType.CARRINHO,
          setor: SectorType.ENFERMAGEM,
      },
    });

    return {
      medicamentos_geral: Number(medicamentosGeral || 0),
      medicamentos_individual: Number(medicamentosIndividual || 0),
      insumos: Number(insumos || 0),
      carrinho_medicamentos: Number(carrinhoMedicamentos || 0),
      carrinho_insumos: Number(carrinhoInsumos || 0),
    };
  }

  async findMedicineStockById(id: number) {
    return MedicineStockModel.findByPk(id);
  }

  async removeIndividualMedicine(estoqueId: number) {
    await MedicineStockModel.update(
      {
        casela_id: null,
        tipo: 'geral',
      },
      {
        where: { id: estoqueId },
      },
    );

    return {
      message: 'Medicamento removido do estoque individual',
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

  async transferMedicineSector(
    estoqueId: number,
    setor: 'farmacia' | 'enfermagem',
  ) {
    await MedicineStockModel.update({ setor }, { where: { id: estoqueId } });

    return {
      message: 'Medicamento transferido de setor com sucesso',
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
      if ('preco' in data) updateData.preco = data.preco ?? null;
      if (data.tipo) updateData.tipo = data.tipo;

      if (updateData.armario_id != null && updateData.gaveta_id != null) {
        throw new Error(
          'Não é permitido preencher armário e gaveta ao mesmo tempo',
        );
      }

      if (updateData.validade != null && updateData.validade < new Date()) {
        throw new Error(
          'A data de validade não pode ser anterior à data atual',
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
      if ('preco' in data) updateData.preco = data.preco ?? null;
      if (data.tipo != null && data.tipo !== '') {
        updateData.tipo = data.tipo;
      }

      if (updateData.armario_id != null && updateData.gaveta_id != null) {
        throw new Error(
          'Não é permitido preencher armário e gaveta ao mesmo tempo',
        );
      }

      if (updateData.validade != null && updateData.validade < new Date()) {
        throw new Error(
          'A data de validade não pode ser anterior à data atual',
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

  async transferInputSector(
    estoqueId: number,
    setor: 'farmacia' | 'enfermagem',
  ) {
    await InputStockModel.update({ setor }, { where: { id: estoqueId } });

    return {
      message: 'Insumo transferido de setor com sucesso',
    };
  }

  async removeIndividualInput(estoqueId: number) {
    await InputStockModel.update(
      {
        casela_id: null,
        tipo: 'geral',
      },
      {
        where: { id: estoqueId },
      },
    );

    return {
      message: 'Insumo removido do estoque individual',
    };
  }
}
