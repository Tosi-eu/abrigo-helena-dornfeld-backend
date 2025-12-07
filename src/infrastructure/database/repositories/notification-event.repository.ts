import { formatDateToPtBr } from "../../helpers/date.helper";
import LoginModel from "../models/login.model";
import MedicineModel from "../models/medicamento.model";
import NotificationEventModel from "../models/notification-event.model";
import ResidentModel from "../models/residente.model";

export class NotificationEventRepository {
  async create(data: {
    medicamento_id: number;
    residente_id: number;
    destino: "SUS" | "Família";
    data_prevista: Date;
    criado_por: number;
  }) {
    return NotificationEventModel.create(data);
  }

  async list(page: number = 1, limit: number = 10, status?: string) {
    const offset = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const { rows, count } = await NotificationEventModel.findAndCountAll({
      where,
      offset,
      limit,
      order: [["data_prevista", "ASC"]],
      include: [
        {
          model: ResidentModel,
          as: "residente",
          attributes: ["nome"],
        },
        {
          model: MedicineModel,
          as: "medicamento",
          attributes: ["nome"],
        },
        {
          model: LoginModel,
          as: "usuario",
          attributes: { exclude: ["password"] },
        },
      ],
    });

    const data = rows.map((row) => ({
      id: row.id,
      destino: row.destino,
      data_prevista: formatDateToPtBr(row.data_prevista),
      status: row.status,
      criado_por: row.criado_por,
      residente_nome: row.residente?.nome,
      medicamento_nome: row.medicamento?.nome,
      medicamento_id: row.medicamento_id,
      residente_id: row.residente_id,
      usuario: row.usuario, 
    }));

    return {
      data: data,
      total: count,
      page,
      limit,
      hasNext: offset + rows.length < count,
    };
  }

  async findById(id: number) {
    return NotificationEventModel.findByPk(id);
  }

  async update(id: number, updates: any) {
    const event = await NotificationEventModel.findByPk(id);
    if (!event) return null;

    await event.update(updates);
    return event;
  }

  async delete(id: number) {
    return (await NotificationEventModel.destroy({ where: { id } })) > 0;
  }
}
