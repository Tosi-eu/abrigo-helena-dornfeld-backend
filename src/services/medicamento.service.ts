import type { Medicine } from '@porto-sdk/sdk';
import type { PrismaMedicineRepository } from '@repositories/medicamento.repository';
import type { IPriceSearchService } from './price-search.types';
import type { TenantConfigService } from './tenant-config.service';
import { logger } from '@helpers/logger.helper';
import { normalizeDosage } from '@helpers/dosage.helper';

const DOSAGE_REGEX = /^\d+([.,]\d+)?(\/\d+([,]\d+)?)?$/;

export class MedicineService {
  constructor(
    private readonly repo: PrismaMedicineRepository,
    private readonly priceSearchService?: IPriceSearchService,
    private readonly tenantConfigService?: TenantConfigService,
  ) {}

  private triggerPriceSearchInBackground(
    medicine: Medicine,
    normalizedDosage: string,
  ) {
    setImmediate(async () => {
      try {
        const search = this.priceSearchService;
        if (!search) return;
        const medicineId = medicine.id;
        if (medicineId == null) return;

        const priceResult = await search.searchPrice(
          medicine.nome,
          'medicine',
          normalizedDosage,
          medicine.unidade_medida,
        );

        if (priceResult?.averagePrice) {
          await this.repo.updateMedicineById(medicineId, {
            preco: priceResult.averagePrice,
          });
        }
      } catch (error) {
        logger.error(
          'Erro ao buscar preço em background',
          {
            operation: 'background_price_search',
            medicineId: medicine.id,
          },
          error as Error,
        );
      }
    });
  }

  async createMedicine(
    tenantId: number,
    data: {
      nome: string;
      dosagem: string;
      unidade_medida: string;
      principio_ativo: string;
      estoque_minimo?: number;
      preco?: number | null;
    },
  ): Promise<Medicine> {
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

    const normalizedDosage = normalizeDosage(data.dosagem.trim());

    let existing = await this.repo.findByUniqueFields(tenantId, {
      nome: data.nome.trim(),
      principio_ativo: data.principio_ativo.trim(),
      dosagem: normalizedDosage,
      unidade_medida: data.unidade_medida,
    });

    if (!existing && data.dosagem.trim() !== normalizedDosage) {
      existing = await this.repo.findByUniqueFields(tenantId, {
        nome: data.nome.trim(),
        principio_ativo: data.principio_ativo.trim(),
        dosagem: data.dosagem.trim(),
        unidade_medida: data.unidade_medida,
      });
    }

    if (!existing) {
      const allMatches = await this.repo.findAllMedicines({
        page: 1,
        limit: 100,
        name: data.nome.trim(),
      });

      existing =
        allMatches.data.find(med => {
          const medNormalizedDosage = normalizeDosage(med.dosagem);
          return (
            med.principio_ativo?.trim() === data.principio_ativo.trim() &&
            med.unidade_medida === data.unidade_medida &&
            medNormalizedDosage === normalizedDosage
          );
        }) || null;
    }

    if (existing) {
      throw new Error(
        'Já existe um medicamento com esta combinação de nome, princípio ativo, dosagem e unidade de medida.',
      );
    }

    const dataToSave = {
      ...data,
      dosagem: normalizedDosage,
    };

    const created = await this.repo.createMedicine(dataToSave, tenantId);

    if (
      this.priceSearchService &&
      created.id &&
      (await this.isAutomaticPriceSearchEnabled(tenantId))
    ) {
      this.triggerPriceSearchInBackground(created, normalizedDosage);
    }

    return created;
  }

  private async isAutomaticPriceSearchEnabled(
    tenantId: number,
  ): Promise<boolean> {
    if (!this.tenantConfigService) return true;
    const cfg = await this.tenantConfigService.get(tenantId);
    return cfg.automatic_price_search !== false;
  }

  async findAll({
    page = 1,
    limit = 10,
    name,
  }: {
    page?: number;
    limit?: number;
    name?: string;
  }) {
    return this.repo.findAllMedicines({ page, limit, name });
  }

  async findById(id: number) {
    return this.repo.findMedicineById(id);
  }

  async updateMedicine(
    tenantId: number,
    id: number,
    data: Omit<Medicine, 'id'>,
  ) {
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

    const normalizedDosage = normalizeDosage(data.dosagem.trim());

    let existing = await this.repo.findByUniqueFields(tenantId, {
      nome: data.nome.trim(),
      principio_ativo: data.principio_ativo?.trim() || '',
      dosagem: normalizedDosage,
      unidade_medida: data.unidade_medida,
    });

    if (!existing && data.dosagem.trim() !== normalizedDosage) {
      existing = await this.repo.findByUniqueFields(tenantId, {
        nome: data.nome.trim(),
        principio_ativo: data.principio_ativo?.trim() || '',
        dosagem: data.dosagem.trim(),
        unidade_medida: data.unidade_medida,
      });
    }

    if (!existing) {
      const allMatches = await this.repo.findAllMedicines({
        page: 1,
        limit: 100,
        name: data.nome.trim(),
      });

      existing =
        allMatches.data.find(med => {
          const medNormalizedDosage = normalizeDosage(med.dosagem);
          return (
            med.principio_ativo?.trim() ===
              (data.principio_ativo?.trim() || '') &&
            med.unidade_medida === data.unidade_medida &&
            medNormalizedDosage === normalizedDosage &&
            med.id !== id
          );
        }) || null;
    }

    if (existing && existing.id !== id) {
      throw new Error(
        'Já existe outro medicamento com esta combinação de nome, princípio ativo, dosagem e unidade de medida.',
      );
    }

    return this.repo.updateMedicineById(id, data);
  }

  async deleteMedicine(id: number) {
    return this.repo.deleteMedicineById(id);
  }
}
