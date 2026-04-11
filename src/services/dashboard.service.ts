import { StockService } from './estoque.service';
import { MovementService } from './movimentacao.service';
import { TenantConfigService } from './tenant-config.service';
import type { Prisma } from '@prisma/client';
import type { CacheService } from './redis.service';
import { PrismaSetorRepository } from '@repositories/setor.repository';

export class DashboardService {
  constructor(
    private readonly stockService: StockService,
    private readonly movementService: MovementService,
    private readonly cache: CacheService | undefined,
    private readonly tenantConfigService: TenantConfigService,
    private readonly setorRepo: PrismaSetorRepository,
  ) {}

  async getSummary(tenantId: number, expiringDays?: number) {
    return this.getSummaryInternal(tenantId, undefined, expiringDays);
  }

  private async getSummaryInternal(
    tenantId: number,
    transaction?: Prisma.TransactionClient,
    expiringDays?: number,
  ) {
    const modules = await this.tenantConfigService.get(tenantId);

    const sectorProportionResults = await Promise.all(
      modules.enabled_sectors.map(async key => {
        const row = await this.setorRepo.findByTenantAndKey(
          tenantId,
          key,
          transaction,
        );
        if (!row) {
          return { key, row: null, raw: null as Record<string, number> | null };
        }
        const raw = await this.stockService.getProportionBySectorId(
          tenantId,
          row.id,
          transaction,
        );
        return { key: row.key, row, raw };
      }),
    );

    const nursingRaw =
      sectorProportionResults.find(s => s.key === 'enfermagem')?.raw ?? null;
    const pharmacyRaw =
      sectorProportionResults.find(s => s.key === 'farmacia')?.raw ?? null;

    const [
      alerts,
      medMovements,
      inpMovements,
      rankingMore,
      rankingLess,
      nonMovement,
      cabinetList,
      drawerList,
    ] = await Promise.all([
      this.stockService.getAlertCounts(transaction, expiringDays ?? 45),
      this.movementService.findMedicineMovements({
        tenantId,
        days: 7,
        page: 1,
        limit: 5,
      }),
      this.movementService.listInputMovements({
        tenantId,
        days: 7,
        page: 1,
        limit: 5,
      }),
      this.movementService.getMedicineRanking({
        tenantId,
        type: 'more',
        page: 1,
        limit: 10,
      }),
      this.movementService.getMedicineRanking({
        tenantId,
        type: 'less',
        page: 1,
        limit: 10,
      }),
      this.movementService.getNonMovementedMedicines(tenantId, 10),
      this.stockService.listStock(
        {
          tenantId,
          filter: '',
          type: 'armarios',
          page: 1,
          limit: 10,
        },
        transaction,
      ),
      this.stockService.listStock(
        {
          tenantId,
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
    type MovementSummaryItem = Record<string, unknown> & {
      data?: string | Date;
    };
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
      nursingProportion: nursingRaw
        ? toProportionResponse(nursingRaw as Record<string, number>)
        : null,
      pharmacyProportion: pharmacyRaw
        ? toProportionResponse(pharmacyRaw as Record<string, number>)
        : null,
      sectorProportions: sectorProportionResults
        .filter(s => s.row != null && s.raw != null)
        .map(s => {
          const row = s.row!;
          const raw = s.raw as Record<string, number>;
          return {
            key: row.key,
            nome: row.nome,
            proportion_profile: row.proportion_profile,
            ...toProportionResponse(raw),
          };
        }),
      cabinetStockData: cabinetList,
      drawerStockData: drawerList,
    };
  }

  async getExpiringItems(
    days: number,
    page: number,
    limit: number,
    transaction?: Prisma.TransactionClient,
  ) {
    return this.stockService.getExpiringItems(days, page, limit, transaction);
  }
}
