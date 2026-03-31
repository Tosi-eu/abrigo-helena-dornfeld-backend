import { DrawerCategoryRepository } from '../../infrastructure/database/repositories/categoria-gaveta.repository';

export class DrawerCategoryService {
  constructor(private readonly repo: DrawerCategoryRepository) {}

  async create(nome: string, tenantId: number) {
    return this.repo.create(nome, tenantId);
  }

  async list(page = 1, limit = 10) {
    return this.repo.list(page, limit);
  }

  async get(id: number) {
    return this.repo.findById(id);
  }

  async getByName(nome: string, tenantId: number) {
    return this.repo.findByName(nome, tenantId);
  }

  async update(id: number, nome: string) {
    return this.repo.update(id, nome);
  }

  async delete(id: number) {
    return this.repo.delete(id);
  }
}
