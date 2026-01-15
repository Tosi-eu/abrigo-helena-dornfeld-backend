import { ReportRepository } from '../../infrastructure/database/repositories/relatorio.repository';
import { formatDateToPtBr } from '../../infrastructure/helpers/date.helper';

export class ReportService {
  constructor(private readonly repo: ReportRepository) {}

  async generateReport(type: string, casela?: number) {
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
        const data = await this.repo.getTransfersData();
        return data;
      }

      case 'movimentos_dia': {
        const data = await this.repo.getDailyMovementsData();
        return data;
      }

      case 'medicamentos_residente': {
        if (!casela || isNaN(casela)) {
          throw new Error('Casela do residente é obrigatória');
        }
        const data = await this.repo.getResidentMedicinesData(casela);
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
