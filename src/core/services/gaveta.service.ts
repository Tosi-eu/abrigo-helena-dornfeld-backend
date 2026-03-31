import type { DrawerPersist } from '@porto-sdk/sdk';
import { DrawerRepository } from '../../infrastructure/database/repositories/gaveta.repository';

export class DrawerService {
  constructor(private readonly repo: DrawerRepository) {}

  async createDrawer(
    tenantId: number,
    data: DrawerPersist,
  ): Promise<DrawerPersist> {
    if (!data.numero || data.numero <= 0) {
      throw new Error('Número da gaveta inválido');
    }

    if (!data.categoria_id || data.categoria_id <= 0) {
      throw new Error('Categoria inválida');
    }

    return this.repo.createDrawer(data, tenantId);
  }

  async findAll(page: number, limit: number) {
    return this.repo.findAllDrawers(page, limit);
  }

  async findDrawerByNumber(numero: number) {
    return this.repo.findByDrawerNumber(numero);
  }

  async updateDrawer(numero: number, categoria_id: number) {
    if (!categoria_id || categoria_id <= 0) {
      throw new Error('Categoria inválida');
    }

    return this.repo.update(numero, categoria_id);
  }

  async removeDrawer(numero: number): Promise<boolean> {
    return this.repo.delete(numero);
  }

  async count(): Promise<number> {
    return this.repo.count();
  }
}
