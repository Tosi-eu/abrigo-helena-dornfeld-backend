import type { PrismaResidentRepository } from '@repositories/residente.repository';
import type { Resident } from '@porto-sdk/sdk';

export class ResidentService {
  constructor(private readonly repo: PrismaResidentRepository) {}

  async findAll(page: number = 1, limit: number = 20) {
    return this.repo.findAll(page, limit);
  }

  async findByCasela(casela: number) {
    const resident = await this.repo.findByCasela(casela);
    if (!resident) throw new Error('Residente não encontrado');
    return resident;
  }

  async createResident(tenantId: number, data: Resident) {
    if (!data.casela || !Number.isInteger(data.casela) || data.casela <= 0) {
      throw new Error('Número de casela inválido');
    }

    if (
      !data.nome ||
      typeof data.nome !== 'string' ||
      data.nome.trim() === ''
    ) {
      throw new Error('Nome inválido');
    }

    const exists = await this.repo.findByCasela(data.casela);
    if (exists)
      throw new Error(`Já existe um residente com a casela ${data.casela}`);

    return this.repo.createResident({
      num_casela: data.casela,
      nome: data.nome,
      tenant_id: tenantId,
    });
  }

  async updateResident(tenantId: number, data: Resident) {
    if (
      !data.nome ||
      typeof data.nome !== 'string' ||
      data.nome.trim() === ''
    ) {
      throw new Error('Nome inválido');
    }

    const exists = await this.repo.findByCasela(data.casela);
    if (!exists) throw new Error('Residente não encontrado');

    return this.repo.updateResidentById({
      num_casela: data.casela,
      nome: data.nome,
      tenant_id: tenantId,
    });
  }

  async deleteResident(casela: number): Promise<boolean> {
    const exists = await this.repo.findByCasela(casela);
    if (!exists) return false;

    return this.repo.deleteResidentById(casela);
  }

  async count(): Promise<number> {
    return this.repo.count();
  }
}
