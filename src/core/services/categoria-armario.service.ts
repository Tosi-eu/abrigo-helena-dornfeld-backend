import { CabinetCategoryRepository } from '../../infrastructure/database/repositories/categoria-armario.repository';

export class CabinetCategoryService {
  constructor(private readonly repo: CabinetCategoryRepository) {}

  async create(nome: string) {
    return this.repo.create(nome);
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
