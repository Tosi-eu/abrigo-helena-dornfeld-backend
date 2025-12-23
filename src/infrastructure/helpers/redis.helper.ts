import { QueryPaginationParams } from '../../core/utils/utils';

export class CacheKeyHelper {
  static stockList(params: QueryPaginationParams) {
    return `stock:list:${JSON.stringify(params)}`;
  }

  static stockDashboard() {
    return 'stock:dashboard';
  }

  static stockWildcard() {
    return 'stock:*';
  }

  static movementMedicineList(params: any) {
    return `movement:medicine:list:${JSON.stringify(params)}`;
  }

  static movementInputList(params: any) {
    return `movement:input:list:${JSON.stringify(params)}`;
  }

  static movementRanking(params: any) {
    return `movement:ranking:${JSON.stringify(params)}`;
  }

  static nonMovementedMedicines(limit: number) {
    return `movement:non-movemented:${limit}`;
  }

  static movementWildcard() {
    return 'movement:*';
  }
}
