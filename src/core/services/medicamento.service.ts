import { Medicine } from '../domain/medicamento';
import { MedicineRepository } from '../../infrastructure/database/repositories/medicamento.repository';

const DOSAGE_REGEX = /^\d+([.,]\d+)?(\/\d+([,]\d+)?)?$/;

export class MedicineService {
  constructor(private readonly repo: MedicineRepository) {}

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

    return this.repo.createMedicine(data);
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
    return this.repo.updateMedicineById(id, data);
  }

  async deleteMedicine(id: number) {
    return this.repo.deleteMedicineById(id);
  }

  async updatePrice(id: number, preco: number | null): Promise<boolean> {
    if (preco !== null && preco < 0) {
      throw new Error('Preço não pode ser negativo.');
    }
    return this.repo.updatePriceById(id, preco);
  }
}
