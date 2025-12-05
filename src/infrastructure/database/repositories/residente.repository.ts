import MedicineStockModel from "../models/estoque-medicamento.model";
import ResidentModel from "../models/residente.model";
import { sequelize } from "../sequelize";

export class ResidentRepository {
  async findAll(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const { rows, count } = await ResidentModel.findAndCountAll({
      offset,
      limit,
      order: [["num_casela", "ASC"]],
    });

    return {
      data: rows.map(r => ({ casela: r.num_casela, name: r.nome })),
      hasNext: offset + rows.length < count,
    };
  }

  async findByCasela(casela: number) {
    const row = await ResidentModel.findByPk(casela);
    if (!row) return null;
    return { casela: row.num_casela, name: row.nome };
  }

  async createResident(model: ResidentModel) {
    const row = await model.save();
    return { casela: row.num_casela, name: row.nome };
  }

  async updateResidentById(model: ResidentModel) {
    const row = await ResidentModel.findByPk(model.num_casela);
    if (!row) return null;

    row.nome = model.nome;
    await row.save();
    return { casela: row.num_casela, name: row.nome };
  }

  async deleteResidentById(casela: number): Promise<boolean> {
    const count = await ResidentModel.destroy({ where: { num_casela: casela } });
    return count > 0;
  }
  
  async countMedicationsByCasela(casela: number): Promise<number> {
    return MedicineStockModel.count({
      where: { casela_id: casela },
    });
  }

}