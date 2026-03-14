import { StockService } from './estoque.service';
import { MovementService } from './movimentacao.service';
import { SectorType } from '../utils/utils';
import { CacheKeyHelper } from '../../infrastructure/helpers/redis.helper';
import type { Transaction } from 'sequelize';
import type { CacheService } from './redis.service';

const DASHBOARD_CACHE_TTL = 60;

export class DashboardService {
  constructor(
    private readonly stockService: StockService,
    private readonly movementService: MovementService,
    private readonly cache?: CacheService,
  ) {}

  async getSummary(transaction?: Transaction, expiringDays?: number) {
    if (this.cache && !transaction) {
      const key = CacheKeyHelper.dashboardSummary(expiringDays);
      return this.cache.getOrSet(
        key,
        () => this.getSummaryInternal(transaction, expiringDays),
        DASHBOARD_CACHE_TTL,
      );
    }
    return this.getSummaryInternal(transaction, expiringDays);
  }

  private async getSummaryInternal(
    transaction?: Transaction,
    expiringDays?: number,
  ) {
    const [
      alerts,
      medMovements,
      inpMovements,
      rankingMore,
      rankingLess,
      nonMovement,
      nursingData,
      pharmacyData,
      cabinetList,
      drawerList,
    ] = await Promise.all([
      this.stockService.getAlertCounts(transaction, expiringDays ?? 45),
      this.movementService.findMedicineMovements({
        days: 7,
        page: 1,
        limit: 5,
      }),
      this.movementService.listInputMovements({
        days: 7,
        page: 1,
        limit: 5,
      }),
      this.movementService.getMedicineRanking({
        type: 'more',
        page: 1,
        limit: 10,
      }),
      this.movementService.getMedicineRanking({
        type: 'less',
        page: 1,
        limit: 10,
      }),
      this.movementService.getNonMovementedMedicines(10),
      this.stockService.getProportion(SectorType.ENFERMAGEM, transaction),
      this.stockService.getProportion(SectorType.FARMACIA, transaction),
      this.stockService.listStock(
        {
          filter: '',
          type: 'armarios',
          page: 1,
          limit: 10,
        },
        transaction,
      ),
      this.stockService.listStock(
        {
          filter: '',
          type: 'gavetas',
          page: 1,
          limit: 20,
        },
        transaction,
      ),
    ]);

    const parseDate = (v: unknown): number => {
      if (!v) return 0;
      if (typeof v === 'string' && v.includes('/')) {
        const [d, m, y] = v.split('/');
        if (y && m && d)
          return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
      }
      return new Date(v as string | number).getTime() || 0;
    };
    type MovementSummaryItem = Record<string, unknown> & { data?: string | Date };
    const recentMovements = [
      ...(medMovements.data || []).map((m: MovementSummaryItem) => ({
        ...m,
        _source: 'medicine' as const,
      })),
      ...(inpMovements.data || []).map((m: MovementSummaryItem) => ({
        ...m,
        _source: 'input' as const,
      })),
    ]
      .sort((a, b) => parseDate(b.data) - parseDate(a.data))
      .slice(0, 10);

    const pct = (v: number, totalGeral: number) =>
      totalGeral > 0 ? Number(((v / totalGeral) * 100).toFixed(2)) : 0;

    const toProportionResponse = (data: Record<string, number>) => {
      const totalGeral = Object.values(data).reduce(
        (acc, v) => acc + Number(v || 0),
        0,
      );
      return {
        percentuais: {
          medicamentos_geral: pct(data.medicamentos_geral ?? 0, totalGeral),
          medicamentos_individual: pct(
            data.medicamentos_individual ?? 0,
            totalGeral,
          ),
          insumos_geral: pct(data.insumos_geral ?? 0, totalGeral),
          insumos_individual: pct(data.insumos_individual ?? 0, totalGeral),
          carrinho_emergencia_medicamentos: pct(
            data.carrinho_emergencia_medicamentos ?? 0,
            totalGeral,
          ),
          carrinho_psicotropicos_medicamentos: pct(
            data.carrinho_psicotropicos_medicamentos ?? 0,
            totalGeral,
          ),
          carrinho_emergencia_insumos: pct(
            data.carrinho_emergencia_insumos ?? 0,
            totalGeral,
          ),
          carrinho_psicotropicos_insumos: pct(
            data.carrinho_psicotropicos_insumos ?? 0,
            totalGeral,
          ),
        },
        totais: {
          ...data,
          total_geral: totalGeral,
        },
      };
    };

    return {
      alerts: {
        noStock: alerts.noStock,
        belowMin: alerts.belowMin,
        nearMin: alerts.nearMin,
        expired: alerts.expired,
        expiringSoon: alerts.expiringSoon,
      },
      recentMovements,
      medicineRankingMore: rankingMore,
      medicineRankingLess: rankingLess,
      nonMovementProducts: nonMovement || [],
      nursingProportion: toProportionResponse(
        nursingData as Record<string, number>,
      ),
      pharmacyProportion: toProportionResponse(
        pharmacyData as Record<string, number>,
      ),
      cabinetStockData: cabinetList,
      drawerStockData: drawerList,
    };
  }

  async getExpiringItems(
    days: number,
    page: number,
    limit: number,
    transaction?: Transaction,
  ) {
    return this.stockService.getExpiringItems(days, page, limit, transaction);
  }
}
