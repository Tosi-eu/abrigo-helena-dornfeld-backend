import CabinetCategoryModel from "../models/categorias-armario.model";

export class CabinetCategoryRepository {
  async create(nome: string) {
    return CabinetCategoryModel.create({ nome });
  }

  async list(page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;

    const { rows, count } = await CabinetCategoryModel.findAndCountAll({
      offset,
      limit,
      order: [["nome", "ASC"]],
    });

    return {
      data: rows.map((r) => ({
        id: r.id,
        nome: r.nome,
      })),
      total: count,
      page,
      limit,
      hasNext: offset + rows.length < count,
    };
  }

  async findById(id: number) {
    return CabinetCategoryModel.findByPk(id);
  }

  async update(id: number, nome: string) {
    const item = await CabinetCategoryModel.findByPk(id);
    if (!item) return null;

    await item.update({ nome });
    return item;
  }

  async delete(id: number) {
    return (await CabinetCategoryModel.destroy({ where: { id } })) > 0;
  }
}
