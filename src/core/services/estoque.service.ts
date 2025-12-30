import { StockRepository } from '../../infrastructure/database/repositories/estoque.repository';
import { CacheKeyHelper } from '../../infrastructure/helpers/redis.helper';
import { MedicineStock, InputStock } from '../domain/estoque';
import {
  ItemType,
  MedicineStatus,
  QueryPaginationParams,
  SectorType,
} from '../utils/utils';
import { CacheService } from './redis.service';

export class StockService {
  constructor(
    private readonly repo: StockRepository,
    private readonly cache: CacheService,
  ) {}

  async medicineStockIn(data: MedicineStock) {
    if (
      !data.medicamento_id ||
      (!data.armario_id && !data.gaveta_id) ||
      !data.quantidade
    ) {
      throw new Error('Campos obrigatórios faltando.');
    }

    const result = await this.repo.createMedicineStockIn(data);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async inputStockIn(data: InputStock) {
    if (
      !data.insumo_id ||
      (!data.armario_id && !data.gaveta_id) ||
      !data.quantidade ||
      !data.tipo
    ) {
      throw new Error('Campos obrigatórios faltando.');
    }

    const result = await this.repo.createInputStockIn(data);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async stockOut(data: {
    estoqueId: number;
    tipo: ItemType;
    quantidade: number;
  }) {
    const { estoqueId, tipo, quantidade } = data;

    if (!estoqueId) throw new Error('Nenhum item foi selecionado');
    if (quantidade <= 0) throw new Error('Quantidade inválida.');
    if (!tipo) throw new Error('Tipo de item inválido.');

    const result = await this.repo.createStockOut(estoqueId, tipo, quantidade);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async listStock(params: QueryPaginationParams) {
    const cacheKey = CacheKeyHelper.stockList(params);

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const data = await this.repo.listStockItems(params);

        return {
          ...data,
          data: data.data.map(item => ({
            ...item,
            quantidade: Number(item.quantidade),
          })),
        };
      },
      30,
    );
  }

  async getProportion(setor: 'farmacia' | 'enfermagem') {
    return this.cache.getOrSet(
      CacheKeyHelper.stockDashboard(setor),
      () => this.repo.getStockProportionBySector(setor),
      60,
    );
  }

  async removeIndividualMedicine(estoqueId: number) {
    const stock = await this.repo.findMedicineStockById(estoqueId);

    if (!stock) {
      throw new Error('Medicamento não encontrado');
    }

    if (stock.tipo !== 'individual') {
      throw new Error('Medicamento não é individual');
    }

    const result = await this.repo.removeIndividualMedicine(estoqueId);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async suspendIndividualMedicine(estoqueId: number) {
    const stock = await this.repo.findMedicineStockById(estoqueId);

    if (!stock) {
      throw new Error('Medicamento não encontrado');
    }

    if (stock.casela_id == null) {
      throw new Error('Somente medicamentos individuais podem ser suspensos');
    }

    if (stock.status === MedicineStatus.SUSPENSO) {
      throw new Error('Medicamento já está suspenso');
    }

    const result = await this.repo.suspendIndividualMedicine(estoqueId);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async resumeIndividualMedicine(estoque_id: number) {
    const stock = await this.repo.findMedicineStockById(estoque_id);

    if (!stock) {
      throw new Error('Medicamento não encontrado');
    }

    if (stock.casela_id == null) {
      throw new Error('Somente medicamentos individuais podem ser retomados');
    }

    if (stock.status !== MedicineStatus.SUSPENSO) {
      throw new Error('Medicamento não está suspenso');
    }

    const result = await this.repo.resumeIndividualMedicine(estoque_id);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async transferMedicineSector(
    estoque_id: number,
    setor: 'farmacia' | 'enfermagem',
  ) {
    const stock = await this.repo.findMedicineStockById(estoque_id);

    if (!stock) {
      throw new Error('Medicamento não encontrado');
    }

    if (stock.casela_id == null) {
      throw new Error('Somente medicamentos com casela podem ser transferidos');
    }

    if (stock.status === MedicineStatus.SUSPENSO) {
      throw new Error('Medicamento suspenso não pode ser transferido');
    }

    if (stock.setor === setor) {
      throw new Error('Medicamento já está neste setor');
    }

    const result = await this.repo.transferMedicineSector(estoque_id, setor);

    await this.cache.invalidateByPattern(CacheKeyHelper.stockWildcard());

    return result;
  }

  async deleteStockItem(estoqueId: number, type: 'medicamento' | 'insumo') {
    if (!estoqueId) throw new Error('Estoque inválido');

    if (type === 'medicamento') {
      const stock = await this.repo.findMedicineStockById(estoqueId);
      if (!stock) throw new Error('Medicamento não encontrado no estoque');
      await this.repo.deleteMedicineStock(estoqueId);
      return { message: 'Medicamento deletado do estoque' };
    } else {
      const stock = await this.repo.findInputStockById(estoqueId);
      if (!stock) throw new Error('Insumo não encontrado no estoque');
      await this.repo.deleteInputStock(estoqueId);
      return { message: 'Insumo deletado do estoque' };
    }
  }

  async transferStock(
    estoqueId: number,
    tipo: 'medicamento' | 'insumo',
    setor: SectorType,
  ) {
    if (!estoqueId) throw new Error('Estoque inválido');

    if (tipo === 'medicamento') {
      const stock = await this.repo.findMedicineStockById(estoqueId);

      if (!stock) throw new Error('Medicamento não encontrado');

      if (stock.setor === setor) {
        throw new Error('Medicamento já está neste setor');
      }

      if (stock.status === MedicineStatus.SUSPENSO) {
        throw new Error('Medicamento suspenso não pode ser transferido');
      }

      return this.repo.transferMedicineStock(estoqueId, setor);
    }

    const stock = await this.repo.findInputStockById(estoqueId);

    if (!stock) throw new Error('Insumo não encontrado');

    if (stock.setor === setor) {
      throw new Error('Insumo já está neste setor');
    }

    return this.repo.transferInputStock(estoqueId, setor);
  }
}
