import { MovimentacaoModel } from "../models/movimentacao.model";
import { Op } from "sequelize";
import { Movimentacao } from "../../../core/domain/movimentacao";
import MedicamentoModel from "../models/medicamento.model";
import ArmarioModel from "../models/armario.model";
import ResidenteModel from "../models/residente.model";
import { LoginModel } from "../models/login.model";
import InsumoModel from "../models/insumo.model";

export class MovimentacaoRepository {
  async create(data: Movimentacao) {
    return await MovimentacaoModel.create({
      ...data,
      data: new Date(),
    });
  }

  async findMedicamentos(days: number, type: string) {
    const where: any = { medicamento_id: { [Op.not]: null } };

    if (days > 0) {
      where.data = { [Op.gte]: new Date(Date.now() - days * 86400000) };
    }

    if (type) where.tipo = type;

    return await MovimentacaoModel.findAll({
      where,
      order: [["data", "DESC"]],
      include: [
        { model: MedicamentoModel, attributes: ["nome", "principio_ativo"] },
        { model: ArmarioModel, attributes: ["num_armario"] },
        { model: ResidenteModel, attributes: ["num_casela"] },
        { model: LoginModel, attributes: ["login"] },
      ],
    });
  }

  async findInsumos(days: number, type?: string) {
    const where: any = { insumo_id: { [Op.not]: null } };

    if (days > 0) {
      where.data = { [Op.gte]: new Date(Date.now() - days * 86400000) };
    }

    if (type) where.tipo = type;

    return await MovimentacaoModel.findAll({
      where,
      order: [["data", "DESC"]],
      include: [
        { model: InsumoModel, attributes: ["nome", "descricao"] },
        { model: ArmarioModel, attributes: ["num_armario"] },
        { model: ResidenteModel, attributes: ["num_casela"] },
        { model: LoginModel, attributes: ["login"] },
      ],
    });
  }
}
