import InputModel from "../models/insumo.model";
import { Input } from "../../../core/domain/insumo";

export class InputRepository {
  async createInput(data: Omit<Input, "id">) {
    const input = await InputModel.create(data);
    return new Input(input.id, input.nome, input.descricao ?? "");
  }

  async listAllInputs(): Promise<Input[]> {
    const rows = await InputModel.findAll({ order: [["nome", "ASC"]] });
    return rows.map((r) => new Input(r.id, r.nome, r.descricao ?? ""));
  }

  async updateInputById(id: number, data: Omit<Input, "id">) {
    const insumo = await InputModel.findByPk(id);
    if (!insumo) return null;

    const updated = await insumo.update(data);
    return new Input(updated.id, updated.nome, updated.descricao ?? "");
  }

  async deleteInputById(id: number): Promise<boolean> {
    const count = await InputModel.destroy({ where: { id } });
    return count > 0;
  }
}
