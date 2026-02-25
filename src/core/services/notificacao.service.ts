import { NotificationEventRepository } from '../../infrastructure/database/repositories/notificacao.repository';
import { NotificationUpdateData } from '../../infrastructure/types/notificacao.types';
import {
  EventStatus,
  NotificationDestinoType,
  NotificationEventType,
} from '../../infrastructure/database/models/notificacao.model';
import type { Transaction } from 'sequelize';

export class NotificationEventService {
  constructor(private readonly repo: NotificationEventRepository) {}

  async create(data: {
    medicamento_id: number;
    residente_id: number;
    destino: NotificationDestinoType;
    data_prevista: Date;
    criado_por: number;
    visto: boolean;
    tipo_evento: NotificationEventType;
  }, transaction?: Transaction) {
    return this.repo.create(data, transaction);
  }

  async get(id: number, transaction?: Transaction) {
    return this.repo.findById(id, transaction);
  }

  async list(filters: {
    page: number;
    limit: number;
    tipo: NotificationEventType;
    status?: EventStatus;
    date?: string;
    residente_nome?: string;
    visto?: boolean;
  }, transaction?: Transaction) {
    return this.repo.listWithFilters(filters, transaction);
  }

  async update(id: number, updates: NotificationUpdateData, transaction?: Transaction) {
    return this.repo.update(id, updates, transaction);
  }

  async delete(id: number, transaction?: Transaction) {
    return this.repo.delete(id, transaction);
  }

  async bootstrapReplacementNotifications() {
    return this.repo.bootstrapReplacementNotifications();
  }
}
