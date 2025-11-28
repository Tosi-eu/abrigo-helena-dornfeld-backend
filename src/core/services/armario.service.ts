import { CabinetRepository } from "../../infrastructure/database/repositories/armario.repository";
import { Cabinet } from "../domain/armario";

export class CabinetService {
  constructor(private readonly repo: CabinetRepository) {}

  async createCabinet(data: Cabinet): Promise<Cabinet> {
    return this.repo.createCabinet(data);
  }

  async findAll(): Promise<Cabinet[]> {
    return this.repo.findAllCabinets();
  }

  async findCabinetByNumber(numero: number): Promise<Cabinet | null> {
    return this.repo.findByCabinetNumber(numero);
  }

  async updateCabinet(numero: number, categoria: string): Promise<Cabinet | null> {
    return this.repo.update(numero, categoria);
  }

  async removeCabinet(numero: number): Promise<void> {
    const deleted = await this.repo.delete(numero);

    if (!deleted) {
      throw new Error("Armário não encontrado");
    }
  }
}
