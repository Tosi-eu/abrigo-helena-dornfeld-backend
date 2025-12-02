import { Op } from "sequelize";
import MovementModel from "../models/movimentacao.model";
import Movement from "../../../core/domain/movimentacao";
import MedicineModel from "../models/medicamento.model";
import CabinetModel from "../models/armario.model";
import ResidenteModel from "../models/residente.model";
import LoginModel from "../models/login.model";
import InputModel from "../models/insumo.model";
import { toLocaleDateBRT } from "../../helpers/date.helper";

export interface MovementQueryParams {
  days: number;
  page: number;
  limit: number;
  type?: string;
}

export class MovementRepository {
  async create(data: Movement) {
    return await MovementModel.create({
      ...data,
      data: new Date(),
    });
  }

  async listMedicineMovements({ days, type, page, limit }: MovementQueryParams) {
    const where: any = { medicamento_id: { [Op.not]: null } };

    if (days > 0) {
      where.data = { [Op.gte]: new Date(Date.now() - days * 86400000) };
    }

    if (type) where.tipo = type;

    const offset = (page - 1) * limit;

    const { rows, count } = await MovementModel.findAndCountAll({
      where,
      order: [["data", "DESC"]],
      offset,
      limit,
      include: [
        { model: MedicineModel, attributes: ["nome", "principio_ativo"] },
        { model: CabinetModel, attributes: ["num_armario"] },
        { model: ResidenteModel, attributes: ["num_casela"] },
        { model: LoginModel, attributes: ["login"] },
      ],
    });

    const formatted = rows.map(r => ({
      ...r.get({ plain: true }),
      validade: toLocaleDateBRT(r.validade),
      data: toLocaleDateBRT(r.data),
    }));


    return {
      data: formatted,
      hasNext: count > page * limit,
      total: count,
      page,
      limit,
    };
  }

  async listInputMovements({ days, page, limit }: MovementQueryParams) {
    const where: any = { insumo_id: { [Op.not]: null } };

    if (days > 0) {
      where.data = { [Op.gte]: new Date(Date.now() - days * 86400000) };
    }

    const offset = (page - 1) * limit;

    const { rows, count } = await MovementModel.findAndCountAll({
      where,
      order: [["data", "DESC"]],
      offset,
      limit,
      include: [
        { model: InputModel, attributes: ["nome", "descricao"] },
        { model: CabinetModel, attributes: ["num_armario"] },
        { model: ResidenteModel, attributes: ["num_casela"] },
        { model: LoginModel, attributes: ["login"] },
      ],
    });

    const formatted = rows.map(r => ({
      ...r.get({ plain: true }),
      validade: toLocaleDateBRT(r.validade),
      data: toLocaleDateBRT(r.data),
    }));


    return {
      data: formatted,
      hasNext: count > page * limit,
      total: count,
      page,
      limit,
    };
  }
}
