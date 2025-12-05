import { MovementRepository } from "../../infrastructure/database/repositories/movimentacao.repository";

export class MovementService {
  constructor(private readonly repo: MovementRepository) {}

  async findMedicineMovements(params: any) {
    return this.repo.listMedicineMovements(params);
  }

  async listInputMovements(params: any) {
    return this.repo.listInputMovements(params);
  }

  async createMovement(data: any) {
    if (!data.tipo || !data.quantidade || !data.armario_id || !data.login_id) {
      throw new Error("Campos obrigatórios faltando.");
    }

    return this.repo.create(data);
  }

  async getMedicineRanking(params: any) {
    return this.repo.getMedicineRanking(params);
  }

}