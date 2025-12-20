import { StockRepository } from '../../infrastructure/database/repositories/estoque.repository';
import { MedicineStock, InputStock } from '../domain/estoque';
import {
  ItemType,
  MedicineStatus,
  QueryPaginationParams,
} from '../utils/utils';

export class StockService {
  constructor(private readonly repo: StockRepository) {}

  async medicineStockIn(data: MedicineStock) {
    if (
      !data.medicamento_id ||
      (!data.armario_id && !data.gaveta_id) ||
      !data.quantidade
    )
      throw new Error('Campos obrigatórios faltando.');
    return this.repo.createMedicineStockIn(data);
  }

  async inputStockIn(data: InputStock) {
    if (
      !data.insumo_id ||
      (!data.armario_id && !data.gaveta_id) ||
      !data.quantidade ||
      !data.tipo
    )
      throw new Error('Campos obrigatórios faltando.');
    return this.repo.createInputStockIn(data);
  }

  async stockOut(data: {
    estoqueId: number;
    tipo: ItemType;
    quantidade: number;
  }) {
    const { estoqueId, tipo, quantidade } = data;

    if (!estoqueId) throw new Error('Nenhum item foi selecionado');
    if (quantidade <= 0) throw new Error('Quantidade inválida.');

    if (tipo === ItemType.MEDICAMENTO || tipo === ItemType.INSUMO) {
      return this.repo.createStockOut(estoqueId, tipo, quantidade);
    }

    throw new Error('Tipo inválido.');
  }

  async listStock(params: QueryPaginationParams) {
    const data = await this.repo.listStockItems(params);

    const mappedData = data.data.map(item => ({
      ...item,
      quantidade: Number(item.quantidade),
    }));

    return {
      ...data,
      data: mappedData,
    };
  }

  async getProportion() {
    return this.repo.getStockProportion();
  }

  async removeIndividualMedicine(estoqueId: number) {
    const stock = await this.repo.findMedicineStockById(estoqueId);

    if (!stock) {
      throw new Error('Medicamento não encontrado');
    }

    if (stock.tipo !== 'individual') {
      throw new Error('Medicamento não é individual');
    }

    return this.repo.removeIndividualMedicine(estoqueId);
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

    return this.repo.suspendIndividualMedicine(estoqueId);
  }

  async resumeIndividualMedicine(estoqueId: number) {
    const stock = await this.repo.findMedicineStockById(estoqueId);

    if (!stock) {
      throw new Error('Medicamento não encontrado');
    }

    if (stock.casela_id == null) {
      throw new Error('Somente medicamentos individuais podem ser retomados');
    }

    if (stock.status !== MedicineStatus.SUSPENSO) {
      throw new Error('Medicamento não está suspenso');
    }

    return this.repo.resumeIndividualMedicine(estoqueId);
  }
}
