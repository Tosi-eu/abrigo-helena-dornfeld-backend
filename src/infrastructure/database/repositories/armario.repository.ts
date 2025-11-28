import { Cabinet } from "../../../core/domain/armario";
import CabinetModel from "../models/armario.model";
import InputStockModel from "../models/estoque-insumo.model";
import MedicineStockModel from "../models/estoque-medicamento.model";

export class CabinetRepository {
  async createCabinet(data: Cabinet): Promise<Cabinet> {
    const item = await CabinetModel.create({
      num_armario: data.numero,
      categoria: data.categoria,
    });
    return new Cabinet(item.num_armario, item.categoria);
  }

  async findAllCabinets(): Promise<Cabinet[]> {
    const items = await CabinetModel.findAll({ order: [["num_armario", "ASC"]] });
    return items.map(i => new Cabinet(i.num_armario, i.categoria));
  }

  async findByCabinetNumber(number: number): Promise<Cabinet | null> {
    const item = await CabinetModel.findByPk(number);
    return item ? new Cabinet(item.num_armario, item.categoria) : null;
  }

  async update(number: number, categoria: string): Promise<Cabinet | null> {
    const item = await CabinetModel.findByPk(number);
    if (!item) return null;
    await item.update({ categoria });
    return new Cabinet(item.num_armario, item.categoria);
  }

  async delete(number: number): Promise<boolean> {
    const deleted = await CabinetModel.destroy({ where: { num_armario: number } });
    return deleted > 0;
  }

  async countMedicine(number: number): Promise<number> {
  return MedicineStockModel.count({ where: { armario_id: number } });
}

  async countInput(number: number): Promise<number> {
    return InputStockModel.count({ where: { armario_id: number } });
  }
}
