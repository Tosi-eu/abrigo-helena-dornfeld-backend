import { MovimentacaoRepository } from "../../infrastructure/database/repositories/movimentacao.repository";

export class MovimentacaoService {
  constructor(private readonly repo: MovimentacaoRepository) {}

  async listarMovMedicamentos(days: number, type: string) {
    return this.repo.findMedicamentos(days, type);
  }

  async listarMovInsumos(days: number) {
    return this.repo.findInsumos(days);
  }

  async registrar(data: any) {
    if (!data.tipo || !data.quantidade || !data.armario_id || !data.login_id) {
      throw new Error("Campos obrigatórios faltando.");
    }

    return this.repo.create(data);
  }
}