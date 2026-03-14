import { ReportRepository } from '../../infrastructure/database/repositories/relatorio.repository';
import { formatDateToPtBr } from '../../infrastructure/helpers/date.helper';
import { CacheKeyHelper } from '../../infrastructure/helpers/redis.helper';
import type { CacheService } from './redis.service';

export const MAX_REPORT_ROWS = 10_000;

function assertReportSize(value: unknown, type: string): void {
  if (Array.isArray(value) && value.length > MAX_REPORT_ROWS) {
    throw new Error(
      `RELATORIO_EXCEDE_LIMITE: O relatório "${type}" excedeu o limite de ${MAX_REPORT_ROWS} linhas. Use filtros ou período menor.`,
    );
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const v of Object.values(value)) {
      if (Array.isArray(v) && v.length > MAX_REPORT_ROWS) {
        throw new Error(
          `RELATORIO_EXCEDE_LIMITE: O relatório "${type}" excedeu o limite de ${MAX_REPORT_ROWS} linhas. Use filtros ou período menor.`,
        );
      }
    }
  }
}

export enum MovementPeriod {
  DIARIO = 'diario',
  MENSAL = 'mensal',
  INTERVALO = 'intervalo',
}

export type MovementsParams =
  | {
      periodo: MovementPeriod.DIARIO;
      data: string;
    }
  | {
      periodo: MovementPeriod.MENSAL;
      mes: string; // YYYY-MM
    }
  | {
      periodo: MovementPeriod.INTERVALO;
      data_inicial: string;
      data_final: string;
    };

export type GenerateReportParams =
  | (MovementsParams & { casela?: number; data?: string })
  | { casela?: number; data?: string };

const REPORT_CACHE_TTL = 120;

export class ReportService {
  constructor(
    private readonly repo: ReportRepository,
    private readonly cache?: CacheService,
  ) {}

  async generateReport(type: string, params: GenerateReportParams) {
    const { casela } = params;

    const resolver = async () => this.generateReportInternal(type, params);

    if (this.cache) {
      const key = CacheKeyHelper.report(type, params);
      return this.cache.getOrSet(key, resolver, REPORT_CACHE_TTL);
    }

    return resolver();
  }

  private async generateReportInternal(
    type: string,
    params: GenerateReportParams,
  ) {
    const { casela } = params;

    switch (type) {
      case 'medicamentos': {
        const data = await this.repo.getMedicinesData();
        assertReportSize(data, type);
        return this.formatItemsWithValidity(
          data.map(item => ({ ...item, validade: new Date(item.validade) })),
        );
      }

      case 'insumos': {
        const data = await this.repo.getInputsData();
        assertReportSize(data, type);
        return this.formatItemsWithValidity(
          data.map(item => ({ ...item, validade: new Date(item.validade) })),
        );
      }

      case 'residentes': {
        const detailed = await this.repo.getResidentsData();
        const monthly = await this.repo.getResidentsMonthlyUsage();
        assertReportSize(detailed, type);
        assertReportSize(monthly, type);

        return {
          detalhes: detailed.map(item => ({
            ...item,
            validade: formatDateToPtBr(item.validade),
          })),
          consumo_mensal: monthly.map(item => ({
            ...item,
            data: formatDateToPtBr(item.data),
          })),
        };
      }

      case 'insumos_medicamentos': {
        const data = await this.repo.getAllItemsData();
        assertReportSize(data.medicamentos, type);
        assertReportSize(data.insumos, type);
        return data;
      }

      case 'psicotropicos': {
        const data = await this.repo.getPsicotropicosData();
        assertReportSize(data?.psicotropico, type);
        return data;
      }

      case 'residente_consumo': {
        if (!casela || isNaN(casela)) {
          throw new Error('Casela do residente é obrigatória');
        }
        const report = await this.repo.getResidentConsumptionReport(casela);
        if (!report) {
          throw new Error('Residente não encontrado');
        }
        return report;
      }

      case 'transferencias': {
        let transferData: unknown;
        if (
          'data_inicial' in params &&
          'data_final' in params &&
          params.data_inicial &&
          params.data_final
        ) {
          transferData = await this.repo.getTransfersDataByInterval(
            params.data_inicial,
            params.data_final,
          );
        } else {
          if (!('data' in params) || !params.data) {
            throw new Error(
              'Data é obrigatória para relatório de transferências',
            );
          }
          transferData = await this.repo.getTransfersData(params.data);
        }
        assertReportSize(transferData, type);
        return transferData;
      }

      case 'movimentacoes': {
        if (!('periodo' in params)) {
          throw new Error(
            'Período é obrigatório para relatório de movimentações',
          );
        }

        const { periodo } = params;
        let movData: unknown;

        if (periodo === MovementPeriod.DIARIO) {
          movData = await this.repo.getMovementsByPeriod({
            periodo,
            data: (params as { periodo: MovementPeriod.DIARIO; data: string })
              .data,
          });
        } else if (periodo === MovementPeriod.MENSAL) {
          movData = await this.repo.getMovementsByPeriod({
            periodo,
            mes: (params as { periodo: MovementPeriod.MENSAL; mes: string })
              .mes,
          });
        } else if (periodo === MovementPeriod.INTERVALO) {
          const intervaloParams = params as {
            periodo: MovementPeriod.INTERVALO;
            data_inicial: string;
            data_final: string;
          };

          if (!intervaloParams.data_inicial || !intervaloParams.data_final) {
            throw new Error(
              'Data inicial e final são obrigatórias para relatório de movimentações por intervalo',
            );
          }

          movData = await this.repo.getMovementsByPeriod({
            periodo,
            data_inicial: intervaloParams.data_inicial,
            data_final: intervaloParams.data_final,
          });
        } else {
          throw new Error('Período inválido');
        }
        assertReportSize(movData, type);
        return movData;
      }

      case 'medicamentos_residente': {
        if (!casela || isNaN(casela)) {
          throw new Error('Casela do residente é obrigatória');
        }
        const data = await this.repo.getResidentMedicinesData(casela);
        assertReportSize(data, type);
        return data;
      }

      case 'medicamentos_vencidos': {
        const data = await this.repo.getExpiredMedicinesData();
        assertReportSize(data, type);
        return data;
      }

      case 'expiringSoon': {
        const data = await this.repo.getExpiringSoonData();
        assertReportSize(data, type);
        return data;
      }

      default:
        throw new Error('Tipo inválido');
    }
  }

  private formatItemsWithValidity<T extends { validade: Date }>(data: T[]) {
    return data.map(item => ({
      ...item,
      validade: formatDateToPtBr(item.validade),
    }));
  }
}
