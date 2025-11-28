import { Op } from "sequelize";
import MovementModel from "../models/movimentacao.model";
import Movement from "../../../core/domain/movimentacao";
import MedicineModel from "../models/medicamento.model";
import CabinetModel from "../models/armario.model";
import ResidenteModel from "../models/residente.model";
import LoginModel from "../models/login.model";
import InputModel from "../models/insumo.model";

export class MovementRepository {
  async create(data: Movement) {
    return await MovementModel.create({
      ...data,
      data: new Date(),
    });
  }

  async listMedicineMovements(days: number, type: string) {
    const where: any = { medicamento_id: { [Op.not]: null } };

    if (days > 0) {
      where.data = { [Op.gte]: new Date(Date.now() - days * 86400000) };
    }

    if (type) where.tipo = type;

    return await MovementModel.findAll({
      where,
      order: [["data", "DESC"]],
      include: [
        { model: MedicineModel, attributes: ["nome", "principio_ativo"] },
        { model: CabinetModel, attributes: ["num_armario"] },
        { model: ResidenteModel, attributes: ["num_casela"] },
        { model: LoginModel, attributes: ["login"] },
      ],
    });
  }

  async listInputMovements(days: number, type?: string) {
    const where: any = { insumo_id: { [Op.not]: null } };

    if (days > 0) {
      where.data = { [Op.gte]: new Date(Date.now() - days * 86400000) };
    }

    if (type) where.tipo = type;

    return await MovementModel.findAll({
      where,
      order: [["data", "DESC"]],
      include: [
        { model: InputModel, attributes: ["nome", "descricao"] },
        { model: CabinetModel, attributes: ["num_armario"] },
        { model: ResidenteModel, attributes: ["num_casela"] },
        { model: LoginModel, attributes: ["login"] },
      ],
    });
  }
}
