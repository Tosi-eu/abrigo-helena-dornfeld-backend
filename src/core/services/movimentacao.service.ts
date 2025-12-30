import { MovementRepository } from '../../infrastructure/database/repositories/movimentacao.repository';
import { formatDateToPtBr } from '../../infrastructure/helpers/date.helper';
import { CacheKeyHelper } from '../../infrastructure/helpers/redis.helper';
import { NonMovementedItem } from '../utils/utils';
import { CacheService } from './redis.service';

export class MovementService {
  constructor(
    private readonly repo: MovementRepository,
    private readonly cache: CacheService,
  ) {}

  async findMedicineMovements(params: any) {
    const cacheKey = CacheKeyHelper.movementMedicineList(params);

    return this.cache.getOrSet(
      cacheKey,
      () => this.repo.listMedicineMovements(params),
      30,
    );
  }

  async listInputMovements(params: any) {
    const cacheKey = CacheKeyHelper.movementInputList(params);

    return this.cache.getOrSet(
      cacheKey,
      () => this.repo.listInputMovements(params),
      30,
    );
  }

  async createMovement(data: any) {
    if (
      !data.tipo ||
      !data.quantidade ||
      (!data.armario_id && !data.gaveta_id) ||
      !data.login_id
    ) {
      throw new Error('Campos obrigatórios faltando.');
    }

    const result = await this.repo.create(data);

    await this.cache.invalidateByPattern(CacheKeyHelper.movementWildcard());

    return result;
  }

  async getMedicineRanking(params: any) {
    const cacheKey = CacheKeyHelper.movementRanking(params);

    return this.cache.getOrSet(
      cacheKey,
      () => this.repo.getMedicineRanking(params),
      60,
    );
  }

  async getNonMovementedMedicines(limit = 10): Promise<NonMovementedItem[]> {
    const cacheKey = CacheKeyHelper.nonMovementedMedicines(limit);

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const data = await this.repo.getNonMovementedMedicines(limit);

        return data.map(item => ({
          tipo_item: item.tipo_item,
          item_id: item.item_id,
          nome: item.nome,
          detalhe: item.detalhe ?? null,
          ultima_movimentacao: formatDateToPtBr(item.ultima_movimentacao),
          dias_parados: Number(item.dias_parados),
        }));
      },
      120,
    );
  }
}
