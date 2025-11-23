import { InsumoRepository } from "../../infrastructure/database/repositories/insumo.repository";

export class InsumoService {
  constructor(private readonly repo: InsumoRepository) {}

  cadastrarNovo(data: { nome: string; descricao?: string }) {
    if (!data.nome) throw new Error("Nome é obrigatório");
    return this.repo.criar(data);
  }

  listarTodos() {
    return this.repo.listar();
  }

  atualizar(id: number, data: { nome: string; descricao?: string }) {
    if (!data.nome) throw new Error("Nome é obrigatório");
    return this.repo.atualizar(id, data);
  }

  remover(id: number) {
    return this.repo.remover(id);
  }
}
