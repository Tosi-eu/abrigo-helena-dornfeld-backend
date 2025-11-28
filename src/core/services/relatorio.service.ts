import { ReportRepository } from "../../infrastructure/database/repositories/relatorio.repository";

export class ReportService {
  constructor(private readonly repo: ReportRepository) {}

  async generateReport(type: string) {
    switch (type) {
      case "medicamentos":
        return this.repo.getMedicinesData();

      case "insumos":
        return this.repo.getInputsData();

      case "residentes":
        return this.repo.getResidentsData();

      case "insumos_medicamentos":
        return this.repo.getAllItemsData();

      default:
        throw new Error("Tipo inválido");
    }
  }
}
