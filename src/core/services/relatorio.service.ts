import { ReportRepository } from "../../infrastructure/database/repositories/relatorio.repository";
import { formatDateToPtBr } from "../../infrastructure/helpers/date.helper";

export class ReportService {
  constructor(private readonly repo: ReportRepository) {}

  async generateReport(type: string) {
    switch (type) {
    case "medicamentos": {
      const data = await this.repo.getMedicinesData();
      return this.formatItemsWithValidity(data.map(item => ({...item, validade: new Date(item.validade)})));
    }

    case "insumos": {
      const data = await this.repo.getInputsData();
      return this.formatItemsWithValidity(data.map(item => ({...item, validade: new Date(item.validade)})));
    }
    
      case "residentes": {
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

      case "insumos_medicamentos":
        return this.repo.getAllItemsData();

      case "psicotropicos":
        return this.repo.getPsicotropicosData();

      default:
        throw new Error("Tipo inválido");
    }
  }

  private formatItemsWithValidity<T extends { validade: Date }>(data: T[]) {
    return data.map(item => ({
      ...item,
      validade: formatDateToPtBr(item.validade),
    }));
  }
}

