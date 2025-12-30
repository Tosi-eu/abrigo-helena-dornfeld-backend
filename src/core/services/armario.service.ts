import { CabinetRepository } from '../../infrastructure/database/repositories/armario.repository';
import { Cabinet } from '../domain/armario';

export class CabinetService {
  constructor(private readonly repo: CabinetRepository) {}

  async createCabinet(data: Cabinet): Promise<Cabinet> {
    if (!data.numero || data.numero <= 0) {
      throw new Error('Número do armário inválido');
    }
    if (!data.categoria_id || data.categoria_id <= 0) {
      throw new Error('Categoria inválida');
    }

    return this.repo.createCabinet(data);
  }

  async findAll(page: number, limit: number) {
    return this.repo.findAllCabinets(page, limit);
  }

  async findCabinetByNumber(numero: number) {
    return this.repo.findByCabinetNumber(numero);
  }

  async updateCabinet(numero: number, categoria_id: number) {
    if (!categoria_id || categoria_id <= 0) {
      throw new Error('Categoria inválida');
    }

    return this.repo.update(numero, categoria_id);
  }

  async removeCabinet(numero: number): Promise<boolean> {
    return this.repo.delete(numero);
  }
}
