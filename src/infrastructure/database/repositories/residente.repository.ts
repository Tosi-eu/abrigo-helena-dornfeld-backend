import MedicineStockModel from "../models/estoque-medicamento.model";
import ResidentModel from "../models/residente.model";
import { sequelize } from "../sequelize";

export class ResidentRepository {
  async findAll() {
    const rows = await ResidentModel.findAll({ order: [["num_casela", "ASC"]] });
    return rows.map(r => ({ casela: r.num_casela, name: r.nome }));
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

  async deleteWithMedicationTransfer(casela: number) {
    return sequelize.transaction(async (t) => {

      await MedicineStockModel.update(
        { tipo: "geral", casela_id: null },
        { where: { casela_id: casela }, transaction: t }
      );

      await ResidentModel.destroy({
        where: { num_casela: casela },
        transaction: t,
      });

      return true;
    });
  }
  async countMedicationsByCasela(casela: number): Promise<number> {
    return MedicineStockModel.count({
      where: { casela_id: casela },
    });
  }

}