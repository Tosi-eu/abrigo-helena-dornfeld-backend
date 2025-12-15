import { MovementRepository } from '../../infrastructure/database/repositories/movimentacao.repository';
import { formatDateToPtBr } from '../../infrastructure/helpers/date.helper';
import { NonMovementedItem } from '../utils/utils';

export class MovementService {
  constructor(private readonly repo: MovementRepository) {}

  async findMedicineMovements(params: any) {
    return this.repo.listMedicineMovements(params);
  }

  async listInputMovements(params: any) {
    return this.repo.listInputMovements(params);
  }

  async createMovement(data: any) {
    if (!data.tipo || !data.quantidade || !data.armario_id || !data.login_id) {
      throw new Error('Campos obrigatórios faltando.');
    }

    return this.repo.create(data);
  }

  async getMedicineRanking(params: any) {
    return this.repo.getMedicineRanking(params);
  }

  async getNonMovementedMedicines(limit = 10): Promise<NonMovementedItem[]> {
    const data = await this.repo.getNonMovementedMedicines(limit);

    return data.map(item => ({
      tipo_item: item.tipo_item,
      item_id: item.item_id,
      nome: item.nome,
      detalhe: item.detalhe ?? null,
      ultima_movimentacao: formatDateToPtBr(item.ultima_movimentacao),
      dias_parados: Number(item.dias_parados),
    }));
  }
}
