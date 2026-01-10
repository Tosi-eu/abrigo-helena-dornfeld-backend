import MedicineModel from '../models/medicamento.model';
import { Medicine } from '../../../core/domain/medicamento';

export class MedicineRepository {
  async createMedicine(data: Medicine): Promise<Medicine> {
    const record = await MedicineModel.create({
      nome: data.nome,
      dosagem: data.dosagem,
      unidade_medida: data.unidade_medida,
      principio_ativo: data.principio_ativo ?? null,
      estoque_minimo: data.estoque_minimo ?? 0,
    });

    return {
      id: record.id,
      nome: record.nome,
      dosagem: record.dosagem,
      unidade_medida: record.unidade_medida,
      estoque_minimo: record.estoque_minimo,
      principio_ativo: record.principio_ativo,
    };
  }

  async findAllMedicines({ page, limit }: { page: number; limit: number }) {
    const offset = (page - 1) * limit;

    const { rows, count } = await MedicineModel.findAndCountAll({
      order: [['nome', 'ASC']],
      offset,
      limit,
    });

    return {
      data: rows.map(r => ({
        id: r.id,
        nome: r.nome,
        dosagem: r.dosagem,
        unidade_medida: r.unidade_medida,
        estoque_minimo: r.estoque_minimo,
        principio_ativo: r.principio_ativo,
      })),
      total: count,
      page,
      limit,
      hasNext: count > page * limit,
    };
  }

  async findMedicineById(id: number): Promise<Medicine | null> {
    const row = await MedicineModel.findByPk(id);
    return row
      ? {
          nome: row.nome,
          dosagem: row.dosagem,
          unidade_medida: row.unidade_medida,
          estoque_minimo: row.estoque_minimo,
          principio_ativo: row.principio_ativo,
        }
      : null;
  }

  async updateMedicineById(
    id: number,
    data: Partial<Omit<Medicine, 'id'>>,
  ): Promise<Medicine | null> {
    const result = await MedicineModel.update(data, {
      where: { id },
      returning: true,
    });

    const updated = result[1][0];

    return updated
      ? {
          nome: updated.nome,
          dosagem: updated.dosagem,
          unidade_medida: updated.unidade_medida,
          estoque_minimo: updated.estoque_minimo,
          principio_ativo: updated.principio_ativo,
        }
      : null;
  }

  async deleteMedicineById(id: number): Promise<boolean> {
    const count = await MedicineModel.destroy({ where: { id } });
    return count > 0;
  }
}
