import { Op } from 'sequelize';
import AuditLogModel, { AuditOperationType } from '../models/audit-log.model';

export type AuditOperationFilter = 'create' | 'update' | 'delete';

export interface AuditInsights {
  created: number;
  updated: number;
  deleted: number;
  total: number;
  totalFiltered: number;
  events: Array<{
    id: number;
    user_id: number | null;
    method: string;
    path: string;
    operation_type: string;
    resource: string | null;
    status_code: number;
    duration_ms: number | null;
    created_at: string;
    old_value: string | null;
    new_value: string | null;
  }>;
}

export class AuditRepository {
  async create(data: {
    user_id: number | null;
    method: string;
    path: string;
    operation_type: AuditOperationType;
    resource: string | null;
    status_code: number;
    duration_ms: number;
  }) {
    return AuditLogModel.create(data);
  }

  async getInsights(
    startDate: Date,
    endDate: Date,
    limit = 50,
    offset = 0,
    operationType?: AuditOperationFilter,
  ): Promise<AuditInsights> {
    const where = {
      created_at: {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      },
    };

    const eventsWhere = operationType
      ? { ...where, operation_type: operationType }
      : where;

    const [created, updated, deleted, totalFiltered, events] = await Promise.all([
      AuditLogModel.count({
        where: { ...where, operation_type: 'create' },
      }),
      AuditLogModel.count({
        where: { ...where, operation_type: 'update' },
      }),
      AuditLogModel.count({
        where: { ...where, operation_type: 'delete' },
      }),
      AuditLogModel.count({ where: eventsWhere }),
      AuditLogModel.findAll({
        where: eventsWhere,
        order: [['created_at', 'DESC']],
        limit,
        offset,
        attributes: [
          'id',
          'user_id',
          'method',
          'path',
          'operation_type',
          'resource',
          'status_code',
          'duration_ms',
          'created_at',
          'old_value',
          'new_value',
        ],
      }),
    ]);

    const total = created + updated + deleted;

    return {
      created,
      updated,
      deleted,
      total,
      totalFiltered,
      events: events.map((e) => ({
        id: e.id,
        user_id: e.user_id,
        method: e.method,
        path: e.path,
        operation_type: e.operation_type,
        resource: e.resource,
        status_code: e.status_code,
        duration_ms: e.duration_ms,
        created_at: e.created_at.toISOString(),
        old_value: e.old_value ?? null,
        new_value: e.new_value ?? null,
      })),
    };
  }
}
