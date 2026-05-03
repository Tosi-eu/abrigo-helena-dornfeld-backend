import type { PrismaCabinetCategoryRepository } from '@repositories/categoria-armario.repository';

export class CabinetCategoryService {
  constructor(private readonly repo: PrismaCabinetCategoryRepository) {}

  async create(nome: string, tenantId: number) {
    if (!nome || typeof nome !== 'string' || nome.trim() === '') {
      throw new Error('Nome da categoria é obrigatório');
    }
    return this.repo.create(nome.trim(), tenantId);
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
