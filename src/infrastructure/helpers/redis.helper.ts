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

  static stockCacheVersionKey() {
    return 'stock:cache:version';
  }

  static stockFilterOptions(version: number) {
    return `stock:filter-options:${version}`;
  }

  static stockWildcard() {
    return 'stock:*';
  }

  static stockDashboard(setor: string, version: number) {
    return `stock:dashboard:${setor}:${version}`;
  }

  static stockList(params: QueryPaginationParams, version: number) {
    return `stock:list:${version}:${this.hash(params)}`;
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

  static report(type: string, params: object) {
    return `report:${type}:${this.hash(params)}`;
  }

  static dashboardSummary(expiringDays?: number) {
    return `dashboard:summary:${expiringDays ?? 'default'}`;
  }
}
