import { ReportRepository } from '../../infrastructure/database/repositories/relatorio.repository';
import { formatDateToPtBr } from '../../infrastructure/helpers/date.helper';

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

export class ReportService {
  constructor(private readonly repo: ReportRepository) {}

  async generateReport(type: string, params: GenerateReportParams) {
    const { casela } = params;

    switch (type) {
      case 'medicamentos': {
        const data = await this.repo.getMedicinesData();
        return this.formatItemsWithValidity(
          data.map(item => ({ ...item, validade: new Date(item.validade) })),
        );
      }

      case 'insumos': {
        const data = await this.repo.getInputsData();
        return this.formatItemsWithValidity(
          data.map(item => ({ ...item, validade: new Date(item.validade) })),
        );
      }

      case 'residentes': {
        const detailed = await this.repo.getResidentsData();
        const monthly = await this.repo.getResidentsMonthlyUsage();

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

      case 'insumos_medicamentos':
        return this.repo.getAllItemsData();

      case 'psicotropicos':
        return this.repo.getPsicotropicosData();

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
        if ('data_inicial' in params && 'data_final' in params && params.data_inicial && params.data_final) {
          return this.repo.getTransfersDataByInterval(params.data_inicial, params.data_final);
        }
        
        if (!('data' in params) || !params.data) {
          throw new Error('Data é obrigatória para relatório de transferências');
        }

        return this.repo.getTransfersData(params.data);
      }

      case 'movimentacoes': {
        if (!('periodo' in params)) {
          throw new Error(
            'Período é obrigatório para relatório de movimentações',
          );
        }

        const { periodo } = params;

        if (periodo === MovementPeriod.DIARIO) {
          return this.repo.getMovementsByPeriod({
            periodo,
            data: (params as { periodo: MovementPeriod.DIARIO; data: string }).data,
          });
        }

        if (periodo === MovementPeriod.MENSAL) {
          return this.repo.getMovementsByPeriod({
            periodo,
            mes: (params as { periodo: MovementPeriod.MENSAL; mes: string }).mes,
          });
        }

        if (periodo === MovementPeriod.INTERVALO) {
          const intervaloParams = params as {
            periodo: MovementPeriod.INTERVALO;
            data_inicial: string;
            data_final: string;
          };

          if (!intervaloParams.data_inicial || !intervaloParams.data_final) {
            throw new Error('Data inicial e final são obrigatórias para relatório de movimentações por intervalo');
          }

          return this.repo.getMovementsByPeriod({
            periodo,
            data_inicial: intervaloParams.data_inicial,
            data_final: intervaloParams.data_final,
          });
        }

        throw new Error('Período inválido');
      }

      case 'medicamentos_residente': {
        if (!casela || isNaN(casela)) {
          throw new Error('Casela do residente é obrigatória');
        }
        return this.repo.getResidentMedicinesData(casela);
      }

      case 'medicamentos_vencidos':
        return this.repo.getExpiredMedicinesData();

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
