import { Op } from 'sequelize';
import { formatDateToPtBr, toBrazilDateOnly } from '../../helpers/date.helper';
import LoginModel from '../models/login.model';
import MedicineModel from '../models/medicamento.model';
import NotificationEventModel, {
  EventStatus,
  NotificationDestinoType,
  NotificationEventType,
} from '../models/notificacao.model';
import ResidentModel from '../models/residente.model';
import { NotificationUpdateData } from '../../types/notificacao.types';
import { NotificationWhereOptions } from '../../types/sequelize.types';
import { MovementType, StockItemStatus } from '../../../core/utils/utils';
import MedicineStockModel from '../models/estoque-medicamento.model';
import MovementModel from '../models/movimentacao.model';

export function getTodayInBrazil(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date());
}

export class NotificationEventRepository {
  async create(data: {
    medicamento_id: number;
    residente_id: number;
    destino: NotificationDestinoType;
    data_prevista: Date;
    criado_por: number;
    visto: boolean;
    tipo_evento: NotificationEventType;
  }) {
    return NotificationEventModel.create(data);
  }

  async listWithFilters({
    page = 1,
    limit = 5,
    tipo,
    status = EventStatus.PENDENTE,
    date,
    residente_nome,
  }: {
    page?: number;
    limit?: number;
    tipo: NotificationEventType;
    status?: EventStatus;
    date?: 'today' | 'tomorrow' | string;
    residente_nome?: string;
    casela?: string | number;
  }) {
    const offset = (page - 1) * limit;
  
    const where: NotificationWhereOptions = {
      tipo_evento: tipo,
      status,
    };
  
    if (date === 'today') where.data_prevista = getTodayInBrazil();
    if (date === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      where.data_prevista = toBrazilDateOnly(tomorrow);
    }
    if (date && !['today', 'tomorrow'].includes(date)) where.data_prevista = date;
  
    const include: any[] = [
      {
        model: ResidentModel,
        as: 'residente',
        attributes: ['nome'],
        where: residente_nome
          ? { nome: { [Op.iLike]: `%${residente_nome}%` } } 
          : undefined,
      },
      { model: MedicineModel, as: 'medicamento', attributes: ['nome'] },
      { model: LoginModel, as: 'usuario', attributes: ['first_name', 'last_name'] },
    ];
  
    if (tipo === NotificationEventType.REPOSICAO_ESTOQUE) {
      include.push(
        {
          model: MedicineStockModel,
          as: 'estoque',
          attributes: ['dias_para_repor'],
          required: false,
          on: {
            medicamento_id: { [Op.col]: 'NotificationEventModel.medicamento_id' },
            casela_id: { [Op.col]: 'NotificationEventModel.residente_id' },
          },
        },
        {
          model: MovementModel,
          as: 'movimentacoes',
          attributes: ['quantidade'],
          required: false,
          where: { tipo: MovementType.TRANSFERENCIA, setor: 'enfermagem' },
          on: {
            medicamento_id: { [Op.col]: 'NotificationEventModel.medicamento_id' },
            casela_id: { [Op.col]: 'NotificationEventModel.residente_id' },
          },
          order: [['createdAt', 'DESC']],
          limit: 1,
        },
      );
    }
  
    const { rows, count } = await NotificationEventModel.findAndCountAll({
      distinct: true,
      where,
      offset,
      limit,
      order: [['data_prevista', 'ASC']],
      include,
    });
  
    return {
      items: rows.map((row: any) => ({
        id: row.id,
        destino: row.destino,
        data_prevista: formatDateToPtBr(row.data_prevista),
        status: row.status,
        criado_por: row.criado_por,
        residente_nome: row.residente?.nome,
        medicamento_nome: row.medicamento?.nome,
        medicamento_id: row.medicamento_id,
        residente_id: row.residente_id,
        usuario: row.usuario ? `${row.usuario.first_name} ${row.usuario.last_name}` : 'Sistema',
        quantidade:
          tipo === NotificationEventType.REPOSICAO_ESTOQUE
            ? row.movimentacoes?.[0]?.quantidade ?? null
            : undefined,
        visto: row.visto,
        tipo_evento: row.tipo_evento,
        dias_para_repor:
          tipo === NotificationEventType.REPOSICAO_ESTOQUE
            ? Number(row.estoque?.dias_para_repor) ?? null
            : null,
      })),
      total: count,
      page,
      limit,
      hasNext: offset + rows.length < count,
    };
  }
  
  async findById(id: number) {
    return NotificationEventModel.findByPk(id);
  }

  async bootstrapReplacementNotifications(): Promise<number> {
    const today = toBrazilDateOnly(new Date());
    let created = 0;
  
    const medicineStocks = await MedicineStockModel.findAll({
      where: {
        dias_para_repor: { [Op.ne]: null },
        status: StockItemStatus.ATIVO,
        quantidade: { [Op.gte]: 0 },
      },
    });
  
    for (const stock of medicineStocks) {
      if (!stock.ultima_reposicao || !stock.casela_id) continue;
  
      const lastReposition = toBrazilDateOnly(stock.ultima_reposicao);
      const nextReposition = new Date(lastReposition);
      nextReposition.setDate(nextReposition.getDate() + Number(stock.dias_para_repor));
  
      const existsNotification = await NotificationEventModel.findOne({
        where: {
          tipo_evento: NotificationEventType.REPOSICAO_ESTOQUE,
          medicamento_id: stock.medicamento_id,
          residente_id: stock.casela_id,
          data_prevista: nextReposition,
        },
      });
  
      if (existsNotification) continue;
  
      await NotificationEventModel.create({
        tipo_evento: NotificationEventType.REPOSICAO_ESTOQUE,
        destino: NotificationDestinoType.ESTOQUE,
        medicamento_id: stock.medicamento_id,
        residente_id: stock.casela_id,
        data_prevista: nextReposition,
        criado_por: 1, // Sistema
        visto: false,
        status: EventStatus.PENDENTE,
      });
  
      created++;
    }
  
    return created;
  }
  
  async update(id: number, updates: NotificationUpdateData) {
    const event = await NotificationEventModel.findByPk(id);
    if (!event) return null;

    const updateData: Partial<NotificationEventModel> = {};

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
      updateData.status = statusMap[updates.status] ?? EventStatus.PENDENTE;
    }

    await event.update(updateData);
    return event;
  }

  async delete(id: number) {
    return (await NotificationEventModel.destroy({ where: { id } })) > 0;
  }
}
