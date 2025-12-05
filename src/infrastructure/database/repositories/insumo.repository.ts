import InputModel from "../models/insumo.model";
import { Input } from "../../../core/domain/insumo";

export class InputRepository {
  async createInput(data: Omit<Input, "id">): Promise<Input> {
    const input = await InputModel.create(data);
    return {
      id: input.id,
      nome: input.nome,
      descricao: input.descricao ?? "",
      estoque_minimo: input.estoque_minimo
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
      id: updated.id,
      nome: updated.nome,
      descricao: updated.descricao ?? "",
      estoque_minimo: updated.estoque_minimo
    };
  }

  async deleteInputById(id: number): Promise<boolean> {
    return (await InputModel.destroy({ where: { id } })) > 0;
  }
}
