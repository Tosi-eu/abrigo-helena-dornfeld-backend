import type { DrawerPersist } from '@porto-sdk/sdk';
import type { PrismaDrawerRepository } from '@repositories/gaveta.repository';

export class DrawerService {
  constructor(private readonly repo: PrismaDrawerRepository) {}

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

  async findAll(tenantId: number, page: number, limit: number) {
    return this.repo.findAllDrawers(tenantId, page, limit);
  }

  async findDrawerByNumber(tenantId: number, numero: number) {
    return this.repo.findByDrawerNumber(tenantId, numero);
  }

  async updateDrawer(tenantId: number, numero: number, categoria_id: number) {
    if (!categoria_id || categoria_id <= 0) {
      throw new Error('Categoria inválida');
    }

    return this.repo.update(tenantId, numero, categoria_id);
  }

  async removeDrawer(tenantId: number, numero: number): Promise<boolean> {
    return this.repo.delete(tenantId, numero);
  }

  async count(tenantId: number): Promise<number> {
    return this.repo.count(tenantId);
  }
}
