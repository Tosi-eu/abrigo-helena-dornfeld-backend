import MedicamentoModel from "../models/medicamento.model";
import { Medicamento } from "../../../core/domain/medicamento";

export class MedicamentoRepository {
  async create(data: Omit<Medicamento, "id">): Promise<Medicamento> {
    const record = await MedicamentoModel.create({
      nome: data.nome,
      dosagem: data.dosagem,
      unidade_medida: data.unidade_medida,
      principio_ativo: data.principio_ativo ?? null,
      estoque_minimo: data.estoque_minimo,
    });

    return new Medicamento(
      record.id,
      record.nome,
      Number(record.dosagem),
      record.unidade_medida,
      record.estoque_minimo,
      record.principio_ativo,
    );
  }

  async findAll(): Promise<Medicamento[]> {
    const rows = await MedicamentoModel.findAll({ order: [["nome", "ASC"]] });
    return rows.map(
      (r) =>
        new Medicamento(
          r.id,
          r.nome,
          Number(r.dosagem),
          r.unidade_medida,
          r.estoque_minimo,
          r.principio_ativo
        )
    );
  }

  async findById(id: number): Promise<Medicamento | null> {
    const r = await MedicamentoModel.findByPk(id);
    return r
      ? new Medicamento(
          r.id,
          r.nome,
          Number(r.dosagem),
          r.unidade_medida,
          r.estoque_minimo,
          r.principio_ativo
        )
      : null;
  }

  async update(
    id: number,
    data: Partial<Omit<Medicamento, "id">>
  ): Promise<Medicamento | null> {
    const result = await MedicamentoModel.update(data, {
      where: { id },
      returning: true,
    });

    const updated = result[1][0];

    return updated
      ? new Medicamento(
          updated.id,
          updated.nome,
          Number(updated.dosagem),
          updated.unidade_medida,
          updated.estoque_minimo,
          updated.principio_ativo
        )
      : null;
  }

  async delete(id: number): Promise<boolean> {
    const count = await MedicamentoModel.destroy({ where: { id } });
    return count > 0;
  }
}