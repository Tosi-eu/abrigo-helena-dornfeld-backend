import MedicineModel from '../models/medicamento.model';
import { Medicine } from '../../../core/domain/medicamento';
import { Op } from 'sequelize';

export class MedicineRepository {
  async createMedicine(data: Medicine): Promise<Medicine> {
    const record = await MedicineModel.create({
      nome: data.nome,
      dosagem: data.dosagem,
      unidade_medida: data.unidade_medida,
      principio_ativo: data.principio_ativo ?? null,
      estoque_minimo: data.estoque_minimo ?? 0,
      preco: data.preco ?? null,
    });

    return {
      id: record.id,
      nome: record.nome,
      dosagem: record.dosagem,
      unidade_medida: record.unidade_medida,
      estoque_minimo: record.estoque_minimo,
      principio_ativo: record.principio_ativo,
      preco: record.preco ?? null,
    };
  }

  async findAllMedicines({ page, limit, name }: { page: number; limit: number; name?: string }) {
    const offset = (page - 1) * limit;

    const where: any = {};
    if (name && name.trim()) {
      where.nome = {
        [Op.iLike]: `%${name.trim()}%`,
      };
    }

    const { rows, count } = await MedicineModel.findAndCountAll({
      where,
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
        preco: r.preco ?? null,
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
          id: row.id,
          nome: row.nome,
          dosagem: row.dosagem,
          unidade_medida: row.unidade_medida,
          estoque_minimo: row.estoque_minimo,
          principio_ativo: row.principio_ativo,
          preco: row.preco ?? null,
        }
      : null;
  }

  async findByUniqueFields(fields: {
    nome: string;
    principio_ativo: string;
    dosagem: string;
    unidade_medida: string;
  }): Promise<Medicine | null> {
    const row = await MedicineModel.findOne({
      where: {
        nome: fields.nome,
        principio_ativo: fields.principio_ativo,
        dosagem: fields.dosagem,
        unidade_medida: fields.unidade_medida,
      },
    });
    return row
      ? {
          id: row.id,
          nome: row.nome,
          dosagem: row.dosagem,
          unidade_medida: row.unidade_medida,
          estoque_minimo: row.estoque_minimo,
          principio_ativo: row.principio_ativo,
          preco: row.preco ?? null,
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
          id: updated.id,
          nome: updated.nome,
          dosagem: updated.dosagem,
          unidade_medida: updated.unidade_medida,
          estoque_minimo: updated.estoque_minimo,
          principio_ativo: updated.principio_ativo,
          preco: updated.preco ?? null,
        }
      : null;
  }

  async deleteMedicineById(id: number): Promise<boolean> {
    const count = await MedicineModel.destroy({ where: { id } });
    return count > 0;
  }

}
