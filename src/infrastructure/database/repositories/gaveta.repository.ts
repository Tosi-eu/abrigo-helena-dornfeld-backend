import { Drawer } from '../../../core/domain/gaveta';
import DrawerCategoryModel from '../models/categorias-gaveta.model';
import DrawerModel, { DrawerModel as DrawerModelType } from '../models/gaveta.model';

export class DrawerRepository {
  async createDrawer(data: Drawer): Promise<Drawer> {
    const item = await DrawerModel.create({
      num_gaveta: data.numero,
      categoria_id: data.categoria_id,
    });

    return {
      numero: item.num_gaveta,
      categoria_id: item.categoria_id,
    };
  }

  async findAllDrawers(page: number, limit: number) {
    const offset = (page - 1) * limit;

    const { rows, count } = await DrawerModel.findAndCountAll({
      order: [['num_gaveta', 'ASC']],
      limit,
      offset,
      include: [
        {
          model: DrawerCategoryModel,
          attributes: ['id', 'nome'],
        },
      ],
    });

    const data = rows.map((i: DrawerModelType) => ({
      numero: i.num_gaveta,
      categoria_id: i.categoria_id,
      categoria: i.DrawerCategoryModel?.nome ?? null,
    }));

    return {
      data,
      total: count,
      page,
      limit,
      hasNext: offset + data.length < count,
    };
  }

  async findByDrawerNumber(number: number): Promise<Drawer | null> {
    const item = await DrawerModel.findByPk(number);
    if (!item) return null;

    return {
      numero: item.num_gaveta,
      categoria_id: item.categoria_id,
    };
  }

  async update(number: number, categoria_id: number): Promise<Drawer | null> {
    const item = await DrawerModel.findByPk(number);
    if (!item) return null;

    await item.update({ categoria_id });

    return {
      numero: item.num_gaveta,
      categoria_id: item.categoria_id,
    };
  }

  async delete(number: number): Promise<boolean> {
    const deleted = await DrawerModel.destroy({
      where: { num_gaveta: number },
    });

    return deleted > 0;
  }
}
