import { DrawerRepository } from '../../infrastructure/database/repositories/gaveta.repository';
import { Drawer } from '../domain/gaveta';

export class DrawerService {
  constructor(private readonly repo: DrawerRepository) {}

  async createDrawer(data: Drawer): Promise<Drawer> {
    if (!data.numero || data.numero <= 0) {
      throw new Error('Número da gaveta inválido');
    }

    if (!data.categoria_id || data.categoria_id <= 0) {
      throw new Error('Categoria inválida');
    }

    return this.repo.createDrawer(data);
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
}
