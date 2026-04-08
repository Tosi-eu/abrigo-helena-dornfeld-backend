import type { PrismaResidentRepository } from '@repositories/residente.repository';
import type { Resident } from '@porto-sdk/sdk';

export class ResidentService {
  constructor(private readonly repo: PrismaResidentRepository) {}

  async findAll(tenantId: number, page: number = 1, limit: number = 20) {
    return this.repo.findAll(tenantId, page, limit);
  }

  async findByCasela(tenantId: number, casela: number) {
    const resident = await this.repo.findByCasela(tenantId, casela);
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

    const exists = await this.repo.findByCasela(tenantId, data.casela);
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

    const exists = await this.repo.findByCasela(tenantId, data.casela);
    if (!exists) throw new Error('Residente não encontrado');

    return this.repo.updateResidentById({
      num_casela: data.casela,
      nome: data.nome,
      tenant_id: tenantId,
    });
  }

  async deleteResident(casela: number): Promise<boolean> {
    // Mantido por compatibilidade com chamadas antigas; preferir deleteResidentForTenant.
    const exists = await this.repo.findByCasela(1, casela);
    if (!exists) return false;

    return this.repo.deleteResidentById(1, casela);
  }

  async deleteResidentForTenant(
    tenantId: number,
    casela: number,
  ): Promise<boolean> {
    const exists = await this.repo.findByCasela(tenantId, casela);
    if (!exists) return false;
    return this.repo.deleteResidentById(tenantId, casela);
  }

  async count(tenantId: number): Promise<number> {
    return this.repo.count(tenantId);
  }
}
