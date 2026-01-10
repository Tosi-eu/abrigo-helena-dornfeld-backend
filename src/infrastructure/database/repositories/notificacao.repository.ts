import { formatDateToPtBr } from '../../helpers/date.helper';
import LoginModel from '../models/login.model';
import MedicineModel from '../models/medicamento.model';
import NotificationEventModel, {
  EventStatus,
} from '../models/notificacao.model';
import ResidentModel from '../models/residente.model';
import { NotificationUpdateData } from '../../types/notificacao.types';
import { NotificationWhereOptions } from '../../types/sequelize.types';

export class NotificationEventRepository {
  async create(data: {
    medicamento_id: number;
    residente_id: number;
    destino: 'sus' | 'familia' | 'farmacia';
    data_prevista: Date;
    criado_por: number;
    visto: boolean;
  }) {
    return NotificationEventModel.create(data);
  }

  async list(page: number = 1, limit: number = 10, status?: string) {
    const offset = (page - 1) * limit;

    const where: NotificationWhereOptions = {};
    if (status) where.status = status;

    const { rows, count } = await NotificationEventModel.findAndCountAll({
      where,
      offset,
      limit,
      order: [['data_prevista', 'ASC']],
      include: [
        {
          model: ResidentModel,
          as: 'residente',
          attributes: ['nome'],
        },
        {
          model: MedicineModel,
          as: 'medicamento',
          attributes: ['nome'],
        },
        {
          model: LoginModel,
          as: 'usuario',
          attributes: { exclude: ['password'] },
        },
      ],
    });

    const data = rows.map(row => ({
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

  async update(id: number, updates: NotificationUpdateData) {
    const event = await NotificationEventModel.findByPk(id);
    if (!event) return null;

    const updateData: Partial<{
      status?: EventStatus;
      visto?: boolean;
      data_prevista?: Date;
      destino?: 'sus' | 'familia' | 'farmacia';
    }> = {};

    if (updates.visto !== undefined) updateData.visto = updates.visto;
    if (updates.data_prevista !== undefined)
      updateData.data_prevista = updates.data_prevista;
    if (updates.destino !== undefined) updateData.destino = updates.destino;

    if (updates.status) {
      const statusMap: Record<string, EventStatus> = {
        pending: EventStatus.PENDENTE,
        sent: EventStatus.ENVIADO,
        completed: EventStatus.ENVIADO,
        cancelled: EventStatus.CANCELADO,
      };
      updateData.status = statusMap[updates.status] || EventStatus.PENDENTE;
    }

    await event.update(updateData);
    return event;
  }

  async delete(id: number) {
    return (await NotificationEventModel.destroy({ where: { id } })) > 0;
  }

  async getTodayPendingNotifications() {
    const now = new Date();
    const today = now
      .toLocaleDateString('pt-BR')
      .split('/')
      .reverse()
      .join('-');

    return NotificationEventModel.findAll({
      where: {
        status: 'pending',
        data_prevista: today,
      },
      order: [['data_prevista', 'ASC']],
      include: [
        { model: ResidentModel, as: 'residente', attributes: ['nome'] },
        { model: MedicineModel, as: 'medicamento', attributes: ['nome'] },
        {
          model: LoginModel,
          as: 'usuario',
          attributes: { exclude: ['password'] },
        },
      ],
    });
  }
}
