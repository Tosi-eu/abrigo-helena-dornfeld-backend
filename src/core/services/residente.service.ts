import { ResidenteRepository } from "../../infrastructure/database/repositories/residente.repository";
import ResidenteModel from "../../infrastructure/database/models/residente.model";

export class ResidenteService {
  constructor(private readonly repo: ResidenteRepository) {}

  async findAll() {
    return this.repo.findAll();
  }

  async findByCasela(casela: number) {
    const residente = await this.repo.findByCasela(casela);
    if (!residente) throw new Error("Residente não encontrado");
    return residente;
  }

  async create(data: { casela: number; nome: string }) {
    if (!data.casela || !Number.isInteger(data.casela) || data.casela <= 0) {
      throw new Error("Número de casela inválido");
    }

    if (!data.nome || typeof data.nome !== "string" || data.nome.trim() === "") {
      throw new Error("Nome inválido");
    }

    const exists = await this.repo.findByCasela(data.casela);
    if (exists) throw new Error(`Já existe um residente com a casela ${data.casela}`);

    const model = ResidenteModel.build({
      num_casela: data.casela,
      nome: data.nome,
    });

    return this.repo.create(model);
  }

  async update(data: { casela: number; nome: string }) {
    if (!data.nome || typeof data.nome !== "string" || data.nome.trim() === "") {
      throw new Error("Nome inválido");
    }

    const exists = await this.repo.findByCasela(data.casela);
    if (!exists) throw new Error("Residente não encontrado");

    const model = ResidenteModel.build({
      num_casela: data.casela,
      nome: data.nome,
    });

    return this.repo.update(model);
  }

  async delete(casela: number) {
    const exists = await this.repo.findByCasela(casela);
    if (!exists) throw new Error("Residente não encontrado");

    return this.repo.delete(casela);
  }
}
