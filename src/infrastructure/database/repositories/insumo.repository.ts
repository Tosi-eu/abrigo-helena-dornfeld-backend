import InsumoModel from "../models/insumo.model";
import { Insumo } from "../../../core/domain/insumo";

export class InsumoRepository {
  async criar(data: { nome: string; descricao?: string }) {
    const insumo = await InsumoModel.create(data);
    return new Insumo(insumo.id, insumo.nome, insumo.descricao ?? "");
  }

  async listar(): Promise<Insumo[]> {
    const rows = await InsumoModel.findAll({ order: [["nome", "ASC"]] });
    return rows.map((r) => new Insumo(r.id, r.nome, r.descricao ?? ""));
  }

  async atualizar(id: number, data: { nome: string; descricao?: string }) {
    const insumo = await InsumoModel.findByPk(id);
    if (!insumo) return null;

    const updated = await insumo.update(data);
    return new Insumo(updated.id, updated.nome, updated.descricao ?? "");
  }

  async remover(id: number): Promise<boolean> {
    const count = await InsumoModel.destroy({ where: { id } });
    return count > 0;
  }
}
