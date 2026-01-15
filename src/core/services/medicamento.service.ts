import { Medicine } from '../domain/medicamento';
import { MedicineRepository } from '../../infrastructure/database/repositories/medicamento.repository';
import { PriceSearchService } from './price-search.service';
import { logger } from '../../infrastructure/helpers/logger.helper';

const DOSAGE_REGEX = /^\d+([.,]\d+)?(\/\d+([,]\d+)?)?$/;

export class MedicineService {
  constructor(
    private readonly repo: MedicineRepository,
    private readonly priceSearchService?: PriceSearchService,
  ) {}

  async createMedicine(data: {
    nome: string;
    dosagem: string;
    unidade_medida: string;
    principio_ativo: string;
    estoque_minimo?: number;
    preco?: number | null;
  }): Promise<Medicine> {
    if (!data.nome || !data.unidade_medida || data.dosagem == null) {
      throw new Error('Nome, dosagem e unidade de medida são obrigatórios.');
    }

    if (!DOSAGE_REGEX.test(data.dosagem)) {
      throw new Error('Dosagem inválida.');
    }

    const [numeradorRaw] = data.dosagem.split('/');
    const numerador = Number(numeradorRaw.replace(',', '.'));

    if (isNaN(numerador) || numerador <= 0) {
      throw new Error('Dosagem deve ser maior que zero.');
    }

    const existing = await this.repo.findByUniqueFields({
      nome: data.nome.trim(),
      principio_ativo: data.principio_ativo.trim(),
      dosagem: data.dosagem.trim(),
      unidade_medida: data.unidade_medida,
    });

    if (existing) {
      throw new Error('Já existe um medicamento com esta combinação de nome, princípio ativo, dosagem e unidade de medida.');
    }

    const created = await this.repo.createMedicine(data);

    if (this.priceSearchService && created.id) {
      try {
        const priceResult = await this.priceSearchService.updatePriceInDatabase(
          created.id,
          data.nome,
          'medicine',
          data.dosagem,
          data.unidade_medida,
        );

        if (priceResult.found && priceResult.price) {
          const updated = await this.repo.updateMedicineById(created.id, {
            ...created,
            preco: priceResult.price,
          });
          if (updated) return updated;
        }
      } catch (error) {
        logger.error('Erro ao buscar preço automaticamente', {
          operation: 'create_medicine',
          medicineId: created.id,
          nome: data.nome,
        }, error as Error);
      }
    }

    return created;
  }

  async findAll({ page = 1, limit = 10 }: { page?: number; limit?: number }) {
    return this.repo.findAllMedicines({ page, limit });
  }

  async findById(id: number) {
    return this.repo.findMedicineById(id);
  }

  async updateMedicine(id: number, data: Omit<Medicine, 'id'>) {
    if (!data.nome || data.nome.trim() === '') {
      throw new Error('Nome é obrigatório.');
    }

    const [numerador] = data.dosagem.split('/');

    if (Number(numerador) <= 0) {
      throw new Error('Dosagem deve ser maior que zero.');
    }

    if (!DOSAGE_REGEX.test(data.dosagem)) {
      throw new Error('Dosagem inválida.');
    }

    if (data.unidade_medida && data.unidade_medida.trim() === '') {
      throw new Error('Unidade de medida inválida.');
    }

    if (data.estoque_minimo != null && data.estoque_minimo < 0) {
      throw new Error('Estoque mínimo não pode ser negativo.');
    }

    // Verificar se já existe outro medicamento com a mesma combinação única
    const existing = await this.repo.findByUniqueFields({
      nome: data.nome.trim(),
      principio_ativo: data.principio_ativo?.trim() || '',
      dosagem: data.dosagem.trim(),
      unidade_medida: data.unidade_medida,
    });

    if (existing && existing.id !== id) {
      throw new Error('Já existe outro medicamento com esta combinação de nome, princípio ativo, dosagem e unidade de medida.');
    }

    return this.repo.updateMedicineById(id, data);
  }

  async deleteMedicine(id: number) {
    return this.repo.deleteMedicineById(id);
  }
}
