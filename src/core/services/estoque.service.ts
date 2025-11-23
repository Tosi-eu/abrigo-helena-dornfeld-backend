import { EstoqueRepository } from "../../infrastructure/database/repositories/estoque.repository";
import { EstoqueMedicamento, EstoqueInsumo } from "../domain/estoque";

export class EstoqueService {
  constructor(private readonly repo: EstoqueRepository) {}

  async entradaMedicamento(data: EstoqueMedicamento) {
    if (!data.medicamento_id || !data.armario_id || !data.quantidade)
      throw new Error("Campos obrigatórios faltando.");
    return this.repo.registrarEntradaMedicamento(data);
  }

  async entradaInsumo(data: EstoqueInsumo) {
    if (!data.insumo_id || !data.armario_id || !data.quantidade)
      throw new Error("Campos obrigatórios faltando.");
    return this.repo.registrarEntradaInsumo(data);
  }

  async saida(data: { tipo: string; itemId: number; quantidade: number; armarioId: number }) {
    const { tipo, itemId, quantidade, armarioId } = data;

    if (!tipo || !itemId || !quantidade || !armarioId)
      throw new Error("Campos obrigatórios faltando.");

    if (tipo === "medicamento")
      return this.repo.registrarSaidaMedicamento(itemId, armarioId, quantidade);

    if (tipo === "insumo")
      return this.repo.registrarSaidaInsumo(itemId, armarioId, quantidade);

    throw new Error("Tipo inválido.");
  }

  async listarEstoque(params: { filter: string; type: string }) {
    return this.repo.listarEstoque(params);
  }

  async obterProporcao() {
    return this.repo.obterProporcao();
  }
}