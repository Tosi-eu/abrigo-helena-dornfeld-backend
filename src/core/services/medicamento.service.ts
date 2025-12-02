import { Medicine } from "../domain/medicamento";
import { MedicineRepository } from "../../infrastructure/database/repositories/medicamento.repository";
import { PaginationParams } from "../../infrastructure/web/controllers/medicamento.controller";

export class MedicineService {
  constructor(private readonly repo: MedicineRepository) {}

  async createMedicine(data: {
        nome: string;
        dosagem: number;
        unidade_medida: string;
        principio_ativo: string;
        estoque_minimo?: number;
    }): Promise<Medicine>{
    if (!data.nome || !data.unidade_medida || data.dosagem == null) {
      throw new Error("Nome, dosagem e unidade de medida são obrigatórios.");
    }

    if (data.dosagem <= 0) {
      throw new Error("A dosagem deve ser positiva.");
    }

    return this.repo.createMedicine(data);
  }

  async findAll({ page = 1, limit = 10 }: { page?: number; limit?: number }) {
    return this.repo.findAllMedicines({ page, limit });
  }

  async findById(id: number) {
    return this.repo.findMedicineById(id);
  }

  async updateMedicine(id: number, data: Partial<Omit<Medicine, "id">>) {
    return this.repo.updateMedicineById(id, data);
  }

  async deleteMedicine(id: number) {
    return this.repo.deleteMedicineById(id);
  }
}