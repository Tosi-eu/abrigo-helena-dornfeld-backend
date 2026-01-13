import { Cabinet } from '../../../core/domain/armario';
import CabinetModel from '../models/armario.model';
import CabinetCategoryModel from '../models/categorias-armario.model';
import InputStockModel from '../models/estoque-insumo.model';
import MedicineStockModel from '../models/estoque-medicamento.model';

export class CabinetRepository {
  async createCabinet(data: Cabinet): Promise<Cabinet> {
    const item = await CabinetModel.create({
      num_armario: data.numero,
      categoria_id: data.categoria_id,
    });
    return {
      numero: item.num_armario,
      categoria_id: item.categoria_id,
    };
  }

  async findAllCabinets(page: number, limit: number) {
    const offset = (page - 1) * limit;

    const { rows, count } = await CabinetModel.findAndCountAll({
      order: [['num_armario', 'ASC']],
      limit,
      offset,
      include: [
        {
          model: CabinetCategoryModel,
          attributes: ['id', 'nome'],
        },
      ],
    });

    const data = rows.map(i => ({
      numero: i.num_armario,
      categoria_id: i.categoria_id,
      categoria: i.CabinetCategoryModel?.nome ?? null,
    }));

    return {
      data,
      total: count,
      page,
      limit,
      hasNext: offset + data.length < count,
    };
  }

  async findByCabinetNumber(number: number): Promise<Cabinet | null> {
    const item = await CabinetModel.findByPk(number);
    if (!item) return null;
    return {
      numero: item.num_armario,
      categoria_id: item.categoria_id,
    };
  }

  async update(number: number, categoria_id: number): Promise<Cabinet | null> {
    const item = await CabinetModel.findByPk(number);
    if (!item) return null;
    await item.update({ categoria_id });
    return {
      numero: item.num_armario,
      categoria_id: item.categoria_id,
    };
  }

  async delete(number: number): Promise<boolean> {
    const deleted = await CabinetModel.destroy({
      where: { num_armario: number },
    });
    return deleted > 0;
  }

  async countMedicine(number: number): Promise<number> {
    return MedicineStockModel.count({ where: { armario_id: number } });
  }

  async countInput(number: number): Promise<number> {
    return InputStockModel.count({ where: { armario_id: number } });
  }
}
