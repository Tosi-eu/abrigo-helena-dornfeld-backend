import { NotificationEventRepository } from '../../infrastructure/database/repositories/notification-event.repository';

export class NotificationEventService {
  constructor(private readonly repo: NotificationEventRepository) {}

  async create(data: {
    medicamento_id: number;
    residente_id: number;
    destino: 'SUS' | 'Família';
    data_prevista: Date;
    criado_por: number;
    visto: boolean;
  }) {
    return this.repo.create(data);
  }

  async list(page = 1, limit = 10, status?: string) {
    return this.repo.list(page, limit, status);
  }

  async get(id: number) {
    return this.repo.findById(id);
  }

  async update(id: number, updates: any) {
    return this.repo.update(id, updates);
  }

  async delete(id: number) {
    return this.repo.delete(id);
  }

  async getTodayPending() {
    return this.repo.getTodayPendingNotifications();
  }
}
