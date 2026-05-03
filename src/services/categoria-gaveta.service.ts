import type { PrismaDrawerCategoryRepository } from '@repositories/categoria-gaveta.repository';

export class DrawerCategoryService {
  constructor(private readonly repo: PrismaDrawerCategoryRepository) {}

  async create(nome: string, tenantId: number) {
    return this.repo.create(nome, tenantId);
  }

  async list(tenantId: number, page = 1, limit = 10) {
    return this.repo.list(tenantId, page, limit);
  }

  async get(tenantId: number, id: number) {
    return this.repo.findById(tenantId, id);
  }

  async getByName(nome: string, tenantId: number) {
    return this.repo.findByName(nome, tenantId);
  }

  async update(tenantId: number, id: number, nome: string) {
    return this.repo.update(tenantId, id, nome);
  }

  async delete(tenantId: number, id: number) {
    return this.repo.delete(tenantId, id);
  }
}
