import { StockRepository } from "../../infrastructure/database/repositories/estoque.repository";
import { MedicineStock, InputStock } from "../domain/estoque";
import { ItemType } from "../enum/enum";

export class StockService {
  constructor(private readonly repo: StockRepository) {}

  async medicineStockIn(data: MedicineStock) {
    if (!data.medicamento_id || !data.armario_id || !data.quantidade)
      throw new Error("Campos obrigatórios faltando.");
    return this.repo.createMedicineStockIn(data);
  }

  async inputStockIn(data: InputStock) {
    if (!data.insumo_id || !data.armario_id || !data.quantidade)
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

  async listStock(params: { filter: string; type: string }) {
    return this.repo.listItemsStock(params);
  }

  async getProportion() {
    return this.repo.getStockProportion();
  }
}