import type { PrismaCabinetCategoryRepository } from '@repositories/categoria-armario.repository';

export class CabinetCategoryService {
  constructor(private readonly repo: PrismaCabinetCategoryRepository) {}

  async create(nome: string, tenantId: number) {
    if (!nome || typeof nome !== 'string' || nome.trim() === '') {
      throw new Error('Nome da categoria é obrigatório');
    }
    return this.repo.create(nome.trim(), tenantId);
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
