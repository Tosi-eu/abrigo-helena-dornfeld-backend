import ResidenteModel from "../models/residente.model";

export class ResidenteRepository {
  async findAll() {
    const rows = await ResidenteModel.findAll({ order: [["num_casela", "ASC"]] });
    return rows.map(r => ({ casela: r.num_casela, name: r.nome }));
  }

  async findByCasela(casela: number) {
    const row = await ResidenteModel.findByPk(casela);
    if (!row) return null;
    return { casela: row.num_casela, name: row.nome };
  }

  async create(model: ResidenteModel) {
    const row = await model.save();
    return { casela: row.num_casela, name: row.nome };
  }

  async update(model: ResidenteModel) {
    const row = await ResidenteModel.findByPk(model.num_casela);
    if (!row) return null;

    row.nome = model.nome;
    await row.save();
    return { casela: row.num_casela, name: row.nome };
  }

  async delete(casela: number): Promise<boolean> {
    const count = await ResidenteModel.destroy({ where: { num_casela: casela } });
    return count > 0;
  }
}
