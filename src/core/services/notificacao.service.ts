import { NotificationEventRepository } from '../../infrastructure/database/repositories/notificacao.repository';
import { NotificationUpdateData } from '../../infrastructure/types/notificacao.types';
import {
  EventStatus,
  NotificationDestinoType,
  NotificationEventType,
} from '../../infrastructure/database/models/notificacao.model';

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
  }) {
    return this.repo.create(data);
  }

  async get(id: number) {
    return this.repo.findById(id);
  }

  async list(filters: {
    page: number;
    limit: number;
    tipo: NotificationEventType;
    status?: EventStatus;
    date?: string;
  }) {
    return this.repo.listWithFilters(filters);
  }

  async update(id: number, updates: NotificationUpdateData) {
    return this.repo.update(id, updates);
  }

  async delete(id: number) {
    return this.repo.delete(id);
  }

  async bootstrapReplacementNotifications() {
    return this.repo.bootstrapReplacementNotifications();
  }
}
