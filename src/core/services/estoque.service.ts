import { StockRepository } from "../../infrastructure/database/repositories/estoque.repository";
import { formatDateToPtBr } from "../../infrastructure/helpers/date.helper";
import { MedicineStock, InputStock } from "../domain/estoque";
import { ItemType, NonMovementedItem, QueryPaginationParams } from "../utils/utils";

export class StockService {
  constructor(private readonly repo: StockRepository) {}

  async medicineStockIn(data: MedicineStock) {
    if (!data.medicamento_id || !data.armario_id || !data.quantidade)
      throw new Error("Campos obrigatórios faltando.");
    return this.repo.createMedicineStockIn(data);
  }

  async inputStockIn(data: InputStock) {
    if (!data.insumo_id || !data.armario_id || !data.quantidade || !data.tipo)
      throw new Error("Campos obrigatórios faltando.");
    return this.repo.createInputStockIn(data);
  }

  async stockOut(data: { estoqueId: number; tipo: ItemType; quantidade: number }) {
    const { estoqueId, tipo, quantidade } = data;

    if (!estoqueId) throw new Error("Nenhum item foi selecionado");
    if (quantidade <= 0) throw new Error("Quantidade inválida.");

    if (tipo === ItemType.MEDICAMENTO || tipo === ItemType.INSUMO) {
      return this.repo.createStockOut(estoqueId, tipo, quantidade);
    }

    throw new Error("Tipo inválido.");
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

  async getNonMovementedMedicines(limit = 10): Promise<NonMovementedItem[]> {
    const data = await this.repo.getNonMovementedMedicines(limit);

    return data.map(item => ({
      tipo_item: item.tipo_item,
      item_id: item.item_id,
      nome: item.nome,
      detalhe: item.detalhe ?? null,
      ultima_movimentacao: formatDateToPtBr(item.ultima_movimentacao),
      dias_parados: Number(item.dias_parados),
    }));
  }
}