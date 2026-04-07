import type { Prisma } from '@prisma/client';
import type { PrismaNotificationEventRepository } from '@repositories/notificacao.repository';
import type { TenantConfigService } from './tenant-config.service';
import {
  EventStatus,
  NotificationDestinoType,
  NotificationEventType,
  NotificationUpdateData,
} from '@domain/notificacao.types';

export class NotificationEventService {
  constructor(
    private readonly repo: PrismaNotificationEventRepository,
    private readonly tenantConfigService?: TenantConfigService,
  ) {}

  async create(
    data: {
      tenant_id: number;
      medicamento_id: number;
      residente_id: number;
      destino: NotificationDestinoType;
      data_prevista: Date;
      criado_por: number;
      visto: boolean;
      tipo_evento: NotificationEventType;
    },
    transaction?: Prisma.TransactionClient,
  ) {
    return this.repo.create(data, transaction);
  }

  async get(id: number, transaction?: Prisma.TransactionClient) {
    return this.repo.findById(id, transaction);
  }

  async list(
    filters: {
      page: number;
      limit: number;
      tipo: NotificationEventType;
      status?: EventStatus;
      date?: string;
      residente_nome?: string;
      visto?: boolean;
    },
    transaction?: Prisma.TransactionClient,
  ) {
    return this.repo.listWithFilters(filters, transaction);
  }

  async listForAdmin(
    filters: {
      page?: number;
      limit?: number;
      tipo?: NotificationEventType;
      status?: EventStatus;
      visto?: boolean;
    },
    transaction?: Prisma.TransactionClient,
  ) {
    return this.repo.listAllForAdmin(filters, transaction);
  }

  async update(
    id: number,
    updates: NotificationUpdateData,
    transaction?: Prisma.TransactionClient,
  ) {
    return this.repo.update(id, updates, transaction);
  }

  async delete(id: number, transaction?: Prisma.TransactionClient) {
    return this.repo.delete(id, transaction);
  }

  async bootstrapReplacementNotifications() {
    if (!this.tenantConfigService) {
      return this.repo.bootstrapReplacementNotifications();
    }
    const skip = new Set<number>();
    const ids = await this.tenantConfigService.listAllTenantIds();
    for (const id of ids) {
      const cfg = await this.tenantConfigService.get(id);
      if (cfg.automatic_reposicao_notifications === false) {
        skip.add(id);
      }
    }
    return this.repo.bootstrapReplacementNotifications(skip);
  }
}
