import InputModel from "../models/insumo.model";
import { Input } from "../../../core/domain/insumo";

export class InputRepository {
  async createInput(data: Omit<Input, "id">): Promise<Input> {
    const input = await InputModel.create(data);
    return {
      nome: input.nome,
      descricao: input.descricao ?? "",
    };
  }

  async listAllInputs(
    page: number = 1,
    limit: number = 10
  ): Promise<{
    data: Input[];
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
  }> {
    const offset = (page - 1) * limit;

    const { rows, count } = await InputModel.findAndCountAll({
      limit,
      offset,
      order: [["nome", "ASC"]],
    });

    return {
      data: rows.map((r) => ({
        id: r.id,
        nome: r.nome,
        descricao: r.descricao ?? "",
        estoque_minimo: r.estoque_minimo
      })),
      total: count,
      page,
      limit,
      hasNext: offset + rows.length < count,
    };
  }

  async updateInputById(id: number, data: Omit<Input, "id">): Promise<Input | null> {
    const insumo = await InputModel.findByPk(id);
    if (!insumo) return null;

    const updated = await insumo.update(data);
    return {
      nome: updated.nome,
      descricao: updated.descricao ?? "",
    };
  }

  async deleteInputById(id: number): Promise<boolean> {
    const count = await InputModel.destroy({ where: { id } });
    return count > 0;
  }
}
