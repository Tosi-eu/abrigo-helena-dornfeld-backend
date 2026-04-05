import { Prisma } from '@prisma/client';
import { getDb } from '@repositories/prisma';

export type CreateLoginLogData = {
  user_id?: number | null;
  tenant_id?: number;
  login: string;
  success: boolean;
  ip?: string | null;
  user_agent?: string | null;
};

export type LoginLogListFilters = {
  userId?: number;
  login?: string;
  success?: boolean;
  fromDate?: Date;
  toDate?: Date;
};

export class PrismaLoginLogRepository {
  async create(data: CreateLoginLogData) {
    const record = await getDb().loginLog.create({
      data: {
        user_id: data.user_id ?? null,
        tenant_id: data.tenant_id ?? null,
        login: data.login,
        success: data.success,
        ip: data.ip ?? null,
        user_agent: data.user_agent ?? null,
      },
    });
    return {
      id: record.id,
      user_id: record.user_id,
      login: record.login,
      success: record.success,
      ip: record.ip,
      user_agent: record.user_agent,
      created_at: record.created_at,
    };
  }

  async list(page: number, limit: number, filters: LoginLogListFilters = {}) {
    const where: Prisma.LoginLogWhereInput = {};
    if (filters.userId != null) where.user_id = filters.userId;
    if (filters.login != null && filters.login !== '') {
      where.login = { contains: filters.login, mode: 'insensitive' };
    }
    if (filters.success !== undefined) where.success = filters.success;
    if (filters.fromDate != null || filters.toDate != null) {
      where.created_at = {};
      if (filters.fromDate != null) where.created_at.gte = filters.fromDate;
      if (filters.toDate != null) where.created_at.lte = filters.toDate;
    }

    const [rows, count] = await Promise.all([
      getDb().loginLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
        select: {
          id: true,
          user_id: true,
          login: true,
          success: true,
          ip: true,
          user_agent: true,
          created_at: true,
        },
      }),
      getDb().loginLog.count({ where }),
    ]);

    return {
      data: rows.map(r => ({
        id: r.id,
        user_id: r.user_id,
        login: r.login,
        success: r.success,
        ip: r.ip,
        user_agent: r.user_agent,
        created_at: r.created_at,
      })),
      total: count,
      page,
      limit,
    };
  }

  async countActiveUsersThisMonth(): Promise<number> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    const rows = await getDb().$queryRaw<[{ count: bigint }]>(Prisma.sql`
      SELECT COUNT(DISTINCT user_id)::bigint AS count
      FROM login_log
      WHERE success = true
        AND user_id IS NOT NULL
        AND created_at >= ${start}
        AND created_at <= ${end}
    `);
    return Number(rows[0]?.count ?? 0);
  }

  async listActiveUsersThisMonth(page: number = 1, limit: number = 25) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
    const offset = (safePage - 1) * safeLimit;

    const totalRows = await getDb().$queryRaw<[{ total: bigint }]>(Prisma.sql`
      SELECT COUNT(DISTINCT ll.user_id)::bigint AS total
      FROM login_log ll
      WHERE ll.success = true
        AND ll.user_id IS NOT NULL
        AND ll.created_at >= ${start}
        AND ll.created_at <= ${end}
    `);
    const total = Number(totalRows[0]?.total ?? 0);

    type LeaderboardRow = {
      id: number;
      login: string;
      first_name: string | null;
      last_name: string | null;
      last_login_at: Date;
      logins_count: string;
    };
    const data = await getDb().$queryRaw<LeaderboardRow[]>(Prisma.sql`
      SELECT
        l.id,
        l.login,
        l.first_name,
        l.last_name,
        MAX(ll.created_at) AS last_login_at,
        COUNT(*)::text AS logins_count
      FROM login_log ll
      JOIN login l ON l.id = ll.user_id
      WHERE ll.success = true
        AND ll.user_id IS NOT NULL
        AND ll.created_at >= ${start}
        AND ll.created_at <= ${end}
      GROUP BY l.id, l.login, l.first_name, l.last_name
      ORDER BY last_login_at DESC
      LIMIT ${safeLimit}
      OFFSET ${offset}
    `);

    return {
      data: data.map((r: LeaderboardRow) => ({
        id: Number(r.id),
        login: r.login,
        first_name: r.first_name ?? null,
        last_name: r.last_name ?? null,
        last_login_at: r.last_login_at,
        logins_count: Number(r.logins_count ?? 0),
      })),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }
}
