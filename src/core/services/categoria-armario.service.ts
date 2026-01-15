import { CabinetCategoryRepository } from '../../infrastructure/database/repositories/categoria-armario.repository';

export class CabinetCategoryService {
  constructor(private readonly repo: CabinetCategoryRepository) {}

  async create(nome: string) {
    if (!nome || typeof nome !== 'string' || nome.trim() === '') {
      throw new Error('Nome da categoria é obrigatório');
    }

    const trimmedName = nome.trim();

    const existing = await this.repo.findByName(trimmedName);
    if (existing) {
      throw new Error('Já existe uma categoria com este nome');
    }

    return this.repo.create(trimmedName);
  }

  async list(page = 1, limit = 10) {
    return this.repo.list(page, limit);
  }

  async get(id: number) {
    return this.repo.findById(id);
  }

  async getByName(nome: string) {
    return this.repo.findByName(nome);
  }

  async update(id: number, nome: string) {
    return this.repo.update(id, nome);
  }

  async delete(id: number) {
    return this.repo.delete(id);
  }
}
