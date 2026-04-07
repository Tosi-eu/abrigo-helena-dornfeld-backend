import type { Prisma } from '@prisma/client';
import { enrichAuditEventsBatch } from '@middlewares/audit-enrich.helper';
import { getDb } from '@repositories/prisma';

export type AuditOperationType = 'create' | 'update' | 'delete';

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
    old_value: Record<string, unknown> | null;
    new_value: Record<string, unknown> | null;
  }>;
}

export class PrismaAuditRepository {
  async create(data: {
    user_id: number | null;
    method: string;
    path: string;
    operation_type: AuditOperationType;
    resource: string | null;
    status_code: number;
    duration_ms: number;
  }) {
    return getDb().auditLog.create({
      data: {
        user_id: data.user_id,
        method: data.method,
        path: data.path,
        operation_type: data.operation_type,
        resource: data.resource,
        status_code: data.status_code,
        duration_ms: data.duration_ms,
      },
    });
  }

  async getInsights(
    startDate: Date,
    endDate: Date,
    limit = 50,
    offset = 0,
    operationType?: AuditOperationFilter,
  ): Promise<AuditInsights> {
    const range: Prisma.DateTimeFilter = { gte: startDate, lte: endDate };

    const baseWhere: Prisma.AuditLogWhereInput = { created_at: range };
    const eventsWhere: Prisma.AuditLogWhereInput = operationType
      ? { ...baseWhere, operation_type: operationType }
      : baseWhere;

    const [created, updated, deleted, totalFiltered, events] =
      await Promise.all([
        getDb().auditLog.count({
          where: { ...baseWhere, operation_type: 'create' },
        }),
        getDb().auditLog.count({
          where: { ...baseWhere, operation_type: 'update' },
        }),
        getDb().auditLog.count({
          where: { ...baseWhere, operation_type: 'delete' },
        }),
        getDb().auditLog.count({ where: eventsWhere }),
        getDb().auditLog.findMany({
          where: eventsWhere,
          orderBy: { created_at: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            user_id: true,
            method: true,
            path: true,
            operation_type: true,
            resource: true,
            status_code: true,
            duration_ms: true,
            created_at: true,
            old_value: true,
            new_value: true,
          },
        }),
      ]);

    const total = created + updated + deleted;

    const allValues: (Record<string, unknown> | null)[] = [];
    for (const e of events) {
      const oldVal =
        e.old_value &&
        typeof e.old_value === 'object' &&
        !Array.isArray(e.old_value)
          ? (e.old_value as Record<string, unknown>)
          : null;
      const newVal =
        e.new_value &&
        typeof e.new_value === 'object' &&
        !Array.isArray(e.new_value)
          ? (e.new_value as Record<string, unknown>)
          : null;
      allValues.push(oldVal, newVal);
    }

    const enrichedValues = await enrichAuditEventsBatch(allValues);

    const enrichedEvents = events.map((e, i) => {
      const idx = i * 2;
      const enrichedOld = enrichedValues[idx] ?? null;
      const enrichedNew = enrichedValues[idx + 1] ?? null;
      return {
        id: e.id,
        user_id: e.user_id,
        method: e.method,
        path: e.path,
        operation_type: e.operation_type,
        resource: e.resource,
        status_code: e.status_code,
        duration_ms: e.duration_ms,
        created_at: e.created_at.toISOString(),
        old_value: enrichedOld,
        new_value: enrichedNew,
      };
    });

    return {
      created,
      updated,
      deleted,
      total,
      totalFiltered,
      events: enrichedEvents,
    };
  }
}
