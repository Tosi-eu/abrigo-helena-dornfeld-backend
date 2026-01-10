import InputModel from '../models/insumo.model';
import { Input } from '../../../core/domain/insumo';

export class InputRepository {
  async createInput(data: Omit<Input, 'id'>): Promise<Input> {
    const input = await InputModel.create(data);
    return {
      id: input.id,
      nome: input.nome,
      descricao: input.descricao ?? '',
      estoque_minimo: input.estoque_minimo,
      preco: input.preco ? Number(input.preco) : null,
    };
  }

  async listAllInputs(
    page: number = 1,
    limit: number = 10,
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
      order: [['nome', 'ASC']],
    });

    return {
      data: rows.map(r => ({
        id: r.id,
        nome: r.nome,
        descricao: r.descricao ?? '',
        estoque_minimo: r.estoque_minimo,
        preco: r.preco ? Number(r.preco) : null,
      })),
      total: count,
      page,
      limit,
      hasNext: offset + rows.length < count,
    };
  }

  async updateInputById(
    id: number,
    data: Omit<Input, 'id'>,
  ): Promise<Input | null> {
    const insumo = await InputModel.findByPk(id);
    if (!insumo) return null;

    const updated = await insumo.update(data);

    return {
      id: updated.id,
      nome: updated.nome,
      descricao: updated.descricao ?? '',
      estoque_minimo: updated.estoque_minimo,
      preco: updated.preco ? Number(updated.preco) : null,
    };
  }

  async deleteInputById(id: number): Promise<boolean> {
    return (await InputModel.destroy({ where: { id } })) > 0;
  }

  async updatePriceById(id: number, preco: number | null): Promise<boolean> {
    const [affectedRows] = await InputModel.update(
      { preco },
      { where: { id } }
    );
    return affectedRows > 0;
  }
}
