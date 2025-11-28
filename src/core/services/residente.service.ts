import { ResidentRepository } from "../../infrastructure/database/repositories/residente.repository";
import ResidentModel from "../../infrastructure/database/models/residente.model";
import { Resident } from "../domain/residente";

export class ResidentService {
  constructor(private readonly repo: ResidentRepository) {}

  async findAll() {
    return this.repo.findAll();
  }

  async findByCasela(casela: number) {
    const resident = await this.repo.findByCasela(casela);
    if (!resident) throw new Error("Residente não encontrado");
    return resident;
  }

  async createResident(data: Resident) {
    if (!data.casela || !Number.isInteger(data.casela) || data.casela <= 0) {
      throw new Error("Número de casela inválido");
    }

    if (!data.nome || typeof data.nome !== "string" || data.nome.trim() === "") {
      throw new Error("Nome inválido");
    }

    const exists = await this.repo.findByCasela(data.casela);
    if (exists) throw new Error(`Já existe um residente com a casela ${data.casela}`);

    const model = ResidentModel.build({
      num_casela: data.casela,
      nome: data.nome,
    });

    return this.repo.createResident(model);
  }

  async updateResident(data: Resident) {
    if (!data.nome || typeof data.nome !== "string" || data.nome.trim() === "") {
      throw new Error("Nome inválido");
    }

    const exists = await this.repo.findByCasela(data.casela);
    if (!exists) throw new Error("Residente não encontrado");

    const model = ResidentModel.build({
      num_casela: data.casela,
      nome: data.nome,
    });

    return this.repo.updateResidentById(model);
  }

  async deleteResident(casela: number) {
    const exists = await this.repo.findByCasela(casela);
    if (!exists) throw new Error("Residente não encontrado");

    const medCount = await this.repo.countMedicationsByCasela(casela);

    if (medCount > 0) {
      return this.repo.deleteWithMedicationTransfer(casela);
    }

    return this.repo.deleteResidentById(casela);
  }
}
