import MedicineModel from "../models/medicamento.model";
import { Medicine } from "../../../core/domain/medicamento";

export class MedicineRepository {
  async createMedicine(data: Omit<Medicine, "id">): Promise<Medicine> {
    const record = await MedicineModel.create({
      nome: data.nome,
      dosagem: data.dosagem,
      unidade_medida: data.unidade_medida,
      principio_ativo: data.principio_ativo ?? null,
      estoque_minimo: data.estoque_minimo,
    });

    return new Medicine(
      record.id,
      record.nome,
      Number(record.dosagem),
      record.unidade_medida,
      record.estoque_minimo,
      record.principio_ativo,
    );
  }

  async findAllMedicines(): Promise<Medicine[]> {
    const rows = await MedicineModel.findAll({ order: [["nome", "ASC"]] });
    return rows.map(
      (r) =>
        new Medicine(
          r.id,
          r.nome,
          Number(r.dosagem),
          r.unidade_medida,
          r.estoque_minimo,
          r.principio_ativo
        )
    );
  }

  async findMedicineById(id: number): Promise<Medicine | null> {
    const row = await MedicineModel.findByPk(id);
    return row
      ? new Medicine(
          row.id,
          row.nome,
          Number(row.dosagem),
          row.unidade_medida,
          row.estoque_minimo,
          row.principio_ativo
        )
      : null;
  }

  async updateMedicineById(
    id: number,
    data: Partial<Omit<Medicine, "id">>
  ): Promise<Medicine | null> {
    const result = await MedicineModel.update(data, {
      where: { id },
      returning: true,
    });

    const updated = result[1][0];

    return updated
      ? new Medicine(
          updated.id,
          updated.nome,
          Number(updated.dosagem),
          updated.unidade_medida,
          updated.estoque_minimo,
          updated.principio_ativo
        )
      : null;
  }

  async deleteMedicineById(id: number): Promise<boolean> {
    const count = await MedicineModel.destroy({ where: { id } });
    return count > 0;
  }
}