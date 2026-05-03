import type { CabinetPersist } from '@stokio/sdk';
import type { PrismaCabinetRepository } from '@repositories/armario.repository';

export class CabinetService {
  constructor(private readonly repo: PrismaCabinetRepository) {}

  async createCabinet(
    tenantId: number,
    data: CabinetPersist,
  ): Promise<CabinetPersist> {
    if (!data.numero || data.numero <= 0) {
      throw new Error('Número do armário inválido');
    }
    if (!data.categoria_id || data.categoria_id <= 0) {
      throw new Error('Categoria inválida');
    }

    return this.repo.createCabinet(data, tenantId);
  }

  async findAll(tenantId: number, page: number, limit: number) {
    return this.repo.findAllCabinets(tenantId, page, limit);
  }

  async findCabinetByNumber(tenantId: number, numero: number) {
    return this.repo.findByCabinetNumber(tenantId, numero);
  }

  async updateCabinet(tenantId: number, numero: number, categoria_id: number) {
    if (!categoria_id || categoria_id <= 0) {
      throw new Error('Categoria inválida');
    }

    return this.repo.update(tenantId, numero, categoria_id);
  }

  async removeCabinet(tenantId: number, numero: number): Promise<boolean> {
    return this.repo.delete(tenantId, numero);
  }

  async count(tenantId: number): Promise<number> {
    return this.repo.count(tenantId);
  }
}
