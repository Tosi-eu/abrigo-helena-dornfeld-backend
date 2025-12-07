import { ReportRepository } from "../../infrastructure/database/repositories/relatorio.repository";
import { formatDateToPtBr } from "../../infrastructure/helpers/date.helper";

export class ReportService {
  constructor(private readonly repo: ReportRepository) {}

  async generateReport(type: string) {
    switch (type) {
      case "medicamentos":
        return this.repo.getMedicinesData();

      case "insumos":
        return this.repo.getInputsData();

      case "residentes":
        const detailed = await this.repo.getResidentsData();
        const monthly = await this.repo.getResidentsMonthlyUsage();

        const monthlyFormatted = monthly.map((item) => ({
          ...item,
          data: formatDateToPtBr(item.data),
        }));

        const detailedFormatted = detailed.map((item) => ({
          ...item,
          validade: formatDateToPtBr(item.validade),
        }));

        return {
          detalhes: detailedFormatted,
          consumo_mensal: monthlyFormatted,
        };

      case "insumos_medicamentos":
        return this.repo.getAllItemsData();

      case "psicotropicos":
        return this.repo.getPsicotropicosData();

      default:
        throw new Error("Tipo inválido");
    }
  }
}
