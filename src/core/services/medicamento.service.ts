import { Medicamento } from "../domain/medicamento";
import { MedicamentoRepository } from "../../infrastructure/database/repositories/medicamento.repository";

export class MedicamentoService {
  constructor(private readonly repo: MedicamentoRepository) {}

  async cadastrarNovo(data: {
        nome: string;
        dosagem: number;
        unidade_medida: string;
        principio_ativo?: string | null;
        estoque_minimo: number;
    }): Promise<Medicamento>{
    if (!data.nome || !data.unidade_medida || data.dosagem == null) {
      throw new Error("Nome, dosagem e unidade de medida são obrigatórios.");
    }

    if (data.dosagem <= 0) {
      throw new Error("A dosagem deve ser positiva.");
    }

    return this.repo.create(data);
  }

  async listarTodos() {
    return this.repo.findAll();
  }

  async buscarPorId(id: number) {
    return this.repo.findById(id);
  }

  async atualizar(id: number, dados: Partial<Omit<Medicamento, "id">>) {
    return this.repo.update(id, dados);
  }

  async remover(id: number) {
    return this.repo.delete(id);
  }
}