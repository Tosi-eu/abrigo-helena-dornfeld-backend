import { MovementRepository } from '../../infrastructure/database/repositories/movimentacao.repository';
import { formatDateToPtBr } from '../../infrastructure/helpers/date.helper';
import { CacheKeyHelper } from '../../infrastructure/helpers/redis.helper';
import { NonMovementedItem, OperationType } from '../utils/utils';
import { CacheService } from './redis.service';
import Movement from '../domain/movimentacao';
import {
  MovementQueryParams,
  MovementRankingParams,
  CreateMovementData,
} from '../types/movimentacao.types';

export class MovementService {
  constructor(
    private readonly repo: MovementRepository,
    private readonly cache: CacheService,
  ) {}

  async findMedicineMovements(params: MovementQueryParams) {
    const cacheKey = CacheKeyHelper.movementMedicineList(params);

    return this.cache.getOrSet(
      cacheKey,
      () => this.repo.listMedicineMovements(params),
      30,
    );
  }

  async listInputMovements(params: MovementQueryParams) {
    const cacheKey = CacheKeyHelper.movementInputList(params);

    return this.cache.getOrSet(
      cacheKey,
      () => this.repo.listInputMovements(params),
      30,
    );
  }

  async createMovement(data: CreateMovementData) {
    if (
      !data.tipo ||
      !data.quantidade ||
      (!data.armario_id && !data.gaveta_id) ||
      !data.login_id ||
      !data.setor
    ) {
      throw new Error('Campos obrigatórios faltando.');
    }

    const movement: Movement = {
      tipo: data.tipo as OperationType,
      login_id: data.login_id,
      armario_id: data.armario_id,
      gaveta_id: data.gaveta_id,
      quantidade: data.quantidade,
      insumo_id: data.insumo_id ?? null,
      medicamento_id: data.medicamento_id ?? null,
      casela_id: data.casela_id ?? null,
      validade: data.validade
        ? typeof data.validade === 'string'
          ? new Date(data.validade)
          : data.validade
        : new Date(),
      setor: data.setor,
    };

    const result = await this.repo.create(movement);

    await this.cache.invalidateByPattern(CacheKeyHelper.movementWildcard());

    return result;
  }

  async getMedicineRanking(params: MovementRankingParams) {
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

  async getPharmacyToNursingTransfers(params: {
    startDate?: string;
    endDate?: string;
    page: number;
    limit: number;
  }) {
    const startDate = params.startDate ? new Date(params.startDate) : undefined;
    const endDate = params.endDate ? new Date(params.endDate) : undefined;

    return this.repo.listPharmacyToNursingTransfers({
      startDate,
      endDate,
      page: params.page,
      limit: params.limit,
    });
  }
}
