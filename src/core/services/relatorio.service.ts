import { RelatorioRepository } from "../../infrastructure/database/repositories/relatorio.repository";

export class RelatorioService {
  constructor(private readonly repo: RelatorioRepository) {}

  async gerar(tipo: string) {
    switch (tipo) {
      case "medicamentos":
        return this.repo.getMedicamentos();

      case "insumos":
        return this.repo.getInsumos();

      case "residentes":
        return this.repo.getResidentes();

      case "insumos_medicamentos":
        return this.repo.getCombo();

      default:
        throw new Error("Tipo inválido");
    }
  }
}
