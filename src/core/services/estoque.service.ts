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

  async saida(data: { estoqueId: number; tipo: "medicamento" | "insumo"; quantidade: number }) {
    const { estoqueId, tipo, quantidade } = data;

    if (!estoqueId) throw new Error("Nenhum item foi selecionado");
    if (quantidade <= 0) throw new Error("Quantidade inválida.");

    if (tipo === "medicamento" || tipo === "insumo") {
      return this.repo.registrarSaida(estoqueId, tipo, quantidade);
    }

    throw new Error("Tipo inválido.");
  }

  async listarEstoque(params: { filter: string; type: string }) {
    return this.repo.listarEstoque(params);
  }

  async obterProporcao() {
    return this.repo.obterProporcao();
  }
}