import { MovementRepository } from "../../infrastructure/database/repositories/movimentacao.repository";

export class MovementService {
  constructor(private readonly repo: MovementRepository) {}

  async findMedicineMovements(days: number, type: string) {
    return this.repo.listMedicineMovements(days, type);
  }

  async listInputMovements(days: number) {
    return this.repo.listInputMovements(days);
  }

  async createMovement(data: any) {
    if (!data.tipo || !data.quantidade || !data.armario_id || !data.login_id) {
      throw new Error("Campos obrigatórios faltando.");
    }

    return this.repo.create(data);
  }
}