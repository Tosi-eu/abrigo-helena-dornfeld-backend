import type { Prisma, ErrorEvent } from '@prisma/client';
import { prisma } from '@repositories/prisma';

export type ErrorEventListFilters = {
  source?: string;
  severity?: string;
  category?: string;
  code?: string;
  tenantId?: number;
  from?: Date;
  to?: Date;
  q?: string;
  correlationId?: string;
};

export class PrismaErrorEventRepository {
  async create(data: Prisma.ErrorEventCreateInput): Promise<ErrorEvent> {
    return prisma.errorEvent.create({ data });
  }

  async findById(id: string): Promise<ErrorEvent | null> {
    return prisma.errorEvent.findUnique({ where: { id } });
  }

  async findManyPaginated(
    filters: ErrorEventListFilters,
    page: number,
    limit: number,
  ): Promise<{ rows: ErrorEvent[]; total: number }> {
    const where: Prisma.ErrorEventWhereInput = {};
    if (filters.source) where.source = filters.source;
    if (filters.severity) where.severity = filters.severity;
    if (filters.category) where.category = filters.category;
    if (filters.code) where.code = filters.code;
    if (filters.tenantId != null) where.tenantId = filters.tenantId;
    if (filters.correlationId)
      where.correlationId = {
        contains: filters.correlationId,
        mode: 'insensitive',
      };
    if (filters.from || filters.to) {
      where.occurredAt = {};
      if (filters.from) where.occurredAt.gte = filters.from;
      if (filters.to) where.occurredAt.lte = filters.to;
    }
    if (filters.q?.trim()) {
      where.messageRaw = {
        contains: filters.q.trim(),
        mode: 'insensitive',
      };
    }

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      prisma.errorEvent.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.errorEvent.count({ where }),
    ]);
    return { rows, total };
  }

  async countSince(since: Date): Promise<number> {
    return prisma.errorEvent.count({
      where: { occurredAt: { gte: since } },
    });
  }

  async topSourcesSince(
    since: Date,
    take: number,
  ): Promise<{ key: string; cnt: number }[]> {
    const rows = await prisma.errorEvent.groupBy({
      by: ['source'],
      where: { occurredAt: { gte: since } },
      _count: true,
      orderBy: { _count: { source: 'desc' } },
      take,
    });
    return rows.map(r => ({ key: r.source, cnt: r._count }));
  }

  async topCodesSince(
    since: Date,
    take: number,
  ): Promise<{ key: string; cnt: number }[]> {
    const rows = await prisma.errorEvent.groupBy({
      by: ['code'],
      where: {
        occurredAt: { gte: since },
        code: { not: null },
      },
      _count: true,
      orderBy: { _count: { code: 'desc' } },
      take,
    });
    return rows
      .filter(r => r.code != null && r.code !== '')
      .map(r => ({ key: r.code as string, cnt: r._count }));
  }

  async countBySeveritySince(
    since: Date,
  ): Promise<{ severity: string; cnt: number }[]> {
    const rows = await prisma.errorEvent.groupBy({
      by: ['severity'],
      where: { occurredAt: { gte: since } },
      _count: true,
      orderBy: { _count: { severity: 'desc' } },
    });
    return rows.map(r => ({
      severity: r.severity,
      cnt: r._count,
    }));
  }
}
