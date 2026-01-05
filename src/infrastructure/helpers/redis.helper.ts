import { QueryPaginationParams } from '../../core/utils/utils';
import {
  MovementQueryParams,
  MovementRankingParams,
} from '../../core/types/movimentacao.types';

export class CacheKeyHelper {
  static stockList(params: QueryPaginationParams) {
    return `stock:list:${JSON.stringify(params)}`;
  }

  static stockDashboard(setor: string) {
    return `stock:dashboard:${setor}`;
  }

  static stockWildcard() {
    return 'stock:*';
  }

  static movementMedicineList(params: MovementQueryParams) {
    return `movement:medicine:list:${JSON.stringify(params)}`;
  }

  static movementInputList(params: MovementQueryParams) {
    return `movement:input:list:${JSON.stringify(params)}`;
  }

  static movementRanking(params: MovementRankingParams) {
    return `movement:ranking:${JSON.stringify(params)}`;
  }

  static nonMovementedMedicines(limit: number) {
    return `movement:non-movemented:${limit}`;
  }

  static movementWildcard() {
    return 'movement:*';
  }
}
