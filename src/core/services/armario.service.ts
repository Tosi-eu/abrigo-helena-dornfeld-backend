import { RemanejamentoDTO } from "../../infrastructure/database/models/armario.model";
import { ArmarioRepository } from "../../infrastructure/database/repositories/armario.repository";
import { Armario } from "../domain/armario";

export class ArmarioService {
  constructor(private readonly repo: ArmarioRepository) {}

  async cadastrarNovo(data: { numero: number; categoria: string }): Promise<Armario> {
    return this.repo.create(data);
  }

  async listarTodos(): Promise<Armario[]> {
    return this.repo.findAll();
  }

  async buscarPorNumero(numero: number): Promise<Armario | null> {
    return this.repo.findByNumero(numero);
  }

  async atualizar(numero: number, categoria: string): Promise<Armario | null> {
    return this.repo.update(numero, categoria);
  }

  async remover(numero: number): Promise<void> {
    const deleted = await this.repo.delete(numero);

    if (!deleted) {
      throw new Error("Armário não encontrado");
    }
  }

  async removerComRemanejamento(numero: number, destinos: RemanejamentoDTO): Promise<void> {
    return this.repo.deleteWithTransference(numero, destinos);
  }

  async countMedicamento(numero: number): Promise<number> {
  return this.repo.countMedicamento(numero);
}

  async countInsumo(numero: number): Promise<number> {
    return this.repo.countInsumo(numero);
  }

  async removerComVerificacao(numero: number, destinos?: RemanejamentoDTO): Promise<void> {
    const hasStock =
      (await this.countMedicamento(numero)) > 0 ||
      (await this.countInsumo(numero)) > 0;

    if (hasStock) {
      if (!destinos || (!destinos.destinoMedicamentos && !destinos.destinoInsumos)) {
        throw new Error(
          `O armário ${numero} possui itens em estoque. Informe os armários de destino para remanejamento.`
        );
      }
      return this.removerComRemanejamento(numero, destinos);
    }

    return this.remover(numero);
  }
}
