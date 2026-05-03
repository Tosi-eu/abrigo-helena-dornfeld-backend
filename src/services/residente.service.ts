import type { PrismaResidentRepository } from '@repositories/residente.repository';
import type { Resident } from '@porto-sdk/sdk';
import {
  assertBirthDateNotFuture,
  parseDateOnlyInput,
} from '@helpers/resident-age.helper';

type ResidentInput = Resident & { data_nascimento?: string | null };

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

  async createResident(tenantId: number, data: ResidentInput) {
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

    let dataNascimento: Date | undefined;
    if (
      data.data_nascimento != null &&
      String(data.data_nascimento).trim() !== ''
    ) {
      const d = parseDateOnlyInput(String(data.data_nascimento));
      assertBirthDateNotFuture(d);
      dataNascimento = d;
    }

    return this.repo.createResident({
      num_casela: data.casela,
      nome: data.nome,
      tenant_id: tenantId,
      data_nascimento: dataNascimento,
    });
  }

  async updateResident(tenantId: number, data: ResidentInput) {
    if (
      !data.nome ||
      typeof data.nome !== 'string' ||
      data.nome.trim() === ''
    ) {
      throw new Error('Nome inválido');
    }

    const exists = await this.repo.findByCasela(tenantId, data.casela);
    if (!exists) throw new Error('Residente não encontrado');

    const payload: Parameters<
      PrismaResidentRepository['updateResidentById']
    >[0] = {
      num_casela: data.casela,
      nome: data.nome,
      tenant_id: tenantId,
    };

    if (Object.prototype.hasOwnProperty.call(data, 'data_nascimento')) {
      const raw = data.data_nascimento;
      if (raw === undefined) {
        /* omitido no corpo transformado — não alterar */
      } else if (raw === null || raw === '') {
        payload.data_nascimento = null;
      } else {
        const d = parseDateOnlyInput(String(raw));
        assertBirthDateNotFuture(d);
        payload.data_nascimento = d;
      }
    }

    return this.repo.updateResidentById(payload);
  }

  async deleteResident(casela: number): Promise<boolean> {
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
