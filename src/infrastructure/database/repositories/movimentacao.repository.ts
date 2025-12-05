import { Op } from "sequelize";
import MovementModel from "../models/movimentacao.model";
import Movement from "../../../core/domain/movimentacao";
import MedicineModel from "../models/medicamento.model";
import CabinetModel from "../models/armario.model";
import ResidenteModel from "../models/residente.model";
import LoginModel from "../models/login.model";
import InputModel from "../models/insumo.model";
import { toLocaleDateBRT } from "../../helpers/date.helper";
import sequelize from "sequelize";

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

  async getMedicineRanking({ type, page, limit }: MovementQueryParams) {
    const offset = (page - 1) * limit;
    const orderDirection = type === "less" ? "ASC" : "DESC";

    const result = await MovementModel.findAll({
      where: { medicamento_id: { [Op.not]: null } },

      attributes: [
        "medicamento_id",
        [
          sequelize.literal(
            `SUM(CASE WHEN "MovementModel"."tipo" = 'entrada' THEN "MovementModel"."quantidade" ELSE 0 END)`
          ),
          "total_entradas"
        ],
        [
          sequelize.literal(
            `SUM(CASE WHEN "MovementModel"."tipo" = 'saida' THEN "MovementModel"."quantidade" ELSE 0 END)`
          ),
          "total_saidas"
        ],
        [
          sequelize.literal(
            `COUNT(CASE WHEN "MovementModel"."tipo" = 'entrada' THEN 1 END)`
          ),
          "qtd_entradas"
        ],
        [
          sequelize.literal(
            `COUNT(CASE WHEN "MovementModel"."tipo" = 'saida' THEN 1 END)`
          ),
          "qtd_saidas"
        ],
        [
          sequelize.literal(`SUM("MovementModel"."quantidade")`),
          "total_movimentado"
        ]
      ],

      include: [
        {
          model: MedicineModel,
          attributes: ["id", "nome", "principio_ativo"],
          required: false
        }
      ],

      group: [
        "medicamento_id",
        "MedicineModel.id",
        "MedicineModel.nome",
        "MedicineModel.principio_ativo"
      ],

      order: [[sequelize.literal('"total_movimentado"'), orderDirection]],
      limit,
      offset,
      subQuery: false
    });

    const totalCount = await MovementModel.count({
      where: { medicamento_id: { [Op.not]: null } },
      distinct: true,
      col: "medicamento_id"
    });

    const data = result.map(r => {
      const row = (r as any).get ? (r as any).get({ plain: true }) : r;
      const medicamento = row.MedicineModel
        ? {
            id: row.MedicineModel.id,
            nome: row.MedicineModel.nome,
            principio_ativo: row.MedicineModel.principio_ativo
          }
        : null;
        
      return {
        medicamento_id: row.medicamento_id,
        total_entradas: Number(row.total_entradas) || 0,
        total_saidas: Number(row.total_saidas) || 0,
        qtd_entradas: Number(row.qtd_entradas) || 0,
        qtd_saidas: Number(row.qtd_saidas) || 0,
        total_movimentado: Number(row.total_movimentado) || 0,
        medicamento
      };
    });

    return {
      data,
      hasNext: totalCount > page * limit,
      total: totalCount,
      page,
      limit
    };
  }

}
