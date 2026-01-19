import crypto from 'crypto';
import { QueryPaginationParams } from '../../core/utils/utils';
import {
  MovementQueryParams,
  MovementRankingParams,
} from '../../core/types/movimentacao.types';

export class CacheKeyHelper {
  private static hash(value: unknown): string {
    return crypto
      .createHash('sha1')
      .update(JSON.stringify(value))
      .digest('hex');
  }

  static stockList(params: QueryPaginationParams) {
    return `stock:list:${this.hash(params)}`;
  }

  static stockDashboard(setor: string) {
    return `stock:dashboard:${setor}`;
  }

  static stockWildcard() {
    return 'stock:*';
  }

  static movementMedicineList(params: MovementQueryParams) {
    return `movement:medicine:list:${this.hash(params)}`;
  }

  static movementInputList(params: MovementQueryParams) {
    return `movement:input:list:${this.hash(params)}`;
  }

  static movementRanking(params: MovementRankingParams) {
    return `movement:ranking:${this.hash(params)}`;
  }

  static nonMovementedMedicines(limit: number) {
    return `movement:non-movemented:${limit}`;
  }

  static movementWildcard() {
    return 'movement:*';
  }
}