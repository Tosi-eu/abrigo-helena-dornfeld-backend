import { InputRepository } from "../../infrastructure/database/repositories/insumo.repository";
import { Input } from "../domain/insumo";

export class InputService {
  constructor(private readonly repo: InputRepository) {}

  createInput(data: Omit<Input, "id">) {
    if (!data.nome) throw new Error("Nome é obrigatório");
    return this.repo.createInput(data);
  }

  listPaginated(page: number = 1, limit: number = 10) {
    return this.repo.listAllInputs(page, limit);
  }

  updateInput(id: number, data: Omit<Input, "id">) {
    if (!data.nome) throw new Error("Nome é obrigatório");
    return this.repo.updateInputById(id, data);
  }

  deleteInput(id: number) {
    return this.repo.deleteInputById(id);
  }
}
