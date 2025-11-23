import { Armario } from "../../../core/domain/armario";
import ArmarioModel, { RemanejamentoDTO } from "../models/armario.model";
import EstoqueInsumoModel from "../models/estoque-insumo.model";
import EstoqueMedicamentoModel from "../models/estoque-medicamento.model";
import InsumoModel from "../models/insumo.model";
import MedicamentoModel from "../models/medicamento.model";
import { MovimentacaoModel } from "../models/movimentacao.model";
import { sequelize } from "../sequelize";

export class ArmarioRepository {
  deleteWithRemanejamento(numero: number, destinos: RemanejamentoDTO): void | PromiseLike<void> {
    throw new Error("Method not implemented.");
  }
  async create(data: { numero: number; categoria: string }): Promise<Armario> {
    const item = await ArmarioModel.create({
      num_armario: data.numero,
      categoria: data.categoria,
    });
    return new Armario(item.num_armario, item.categoria);
  }

  async findAll(): Promise<Armario[]> {
    const items = await ArmarioModel.findAll({ order: [["num_armario", "ASC"]] });
    return items.map(i => new Armario(i.num_armario, i.categoria));
  }

  async findByNumero(numero: number): Promise<Armario | null> {
    const item = await ArmarioModel.findByPk(numero);
    return item ? new Armario(item.num_armario, item.categoria) : null;
  }

  async update(numero: number, categoria: string): Promise<Armario | null> {
    const item = await ArmarioModel.findByPk(numero);
    if (!item) return null;
    await item.update({ categoria });
    return new Armario(item.num_armario, item.categoria);
  }

  async delete(numero: number): Promise<boolean> {
    const deleted = await ArmarioModel.destroy({ where: { num_armario: numero } });
    return deleted > 0;
  }

  async deleteWithTransference(numero: number, destinos: RemanejamentoDTO): Promise<void> {
    const armario = await ArmarioModel.findByPk(numero);
    if (!armario) throw new Error("Armário não encontrado");

    await sequelize.transaction(async (t) => {
      if (destinos.destinoMedicamentos) {
        await EstoqueMedicamentoModel.update(
          { armario_id: destinos.destinoMedicamentos },
          { where: { armario_id: numero }, transaction: t }
        );
      }

      if (destinos.destinoInsumos) {
        await EstoqueInsumoModel.update(
          { armario_id: destinos.destinoInsumos },
          { where: { armario_id: numero }, transaction: t }
        );
      }

      await MovimentacaoModel.destroy({
        where: { armario_id: numero },
        transaction: t
      });

      await armario.destroy({ transaction: t });
    });
  }
}
