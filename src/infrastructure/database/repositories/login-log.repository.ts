import { Op, fn, col } from 'sequelize';
import { LoginLogModel } from '../models/login-log.model';

export type CreateLoginLogData = {
  user_id?: number | null;
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

export class LoginLogRepository {
  async create(data: CreateLoginLogData) {
    const record = await LoginLogModel.create({
      user_id: data.user_id ?? null,
      login: data.login,
      success: data.success,
      ip: data.ip ?? null,
      user_agent: data.user_agent ?? null,
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

  async list(
    page: number,
    limit: number,
    filters: LoginLogListFilters = {},
  ) {
    const where: Record<string, unknown> = {};
    if (filters.userId != null) where.user_id = filters.userId;
    if (filters.login != null && filters.login !== '') {
      where.login = { [Op.iLike]: `%${filters.login}%` };
    }
    if (filters.success !== undefined) where.success = filters.success;
    if (filters.fromDate != null || filters.toDate != null) {
      const dateCond: { [Op.gte]?: Date; [Op.lte]?: Date } = {};
      if (filters.fromDate != null) dateCond[Op.gte] = filters.fromDate;
      if (filters.toDate != null) dateCond[Op.lte] = filters.toDate;
      where.created_at = dateCond;
    }

    const { rows, count } = await LoginLogModel.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      attributes: ['id', 'user_id', 'login', 'success', 'ip', 'user_agent', 'created_at'],
    });

    return {
      data: rows.map((r) => ({
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

  /** Count distinct users with at least one successful login in the current month. */
  async countActiveUsersThisMonth(): Promise<number> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const row = await LoginLogModel.findOne({
      where: {
        success: true,
        user_id: { [Op.not]: null },
        created_at: { [Op.gte]: start, [Op.lte]: end },
      },
      attributes: [[fn('COUNT', fn('DISTINCT', col('user_id'))), 'count']],
      raw: true,
    });
    const count = (row as unknown as { count?: string } | null)?.count;
    return Number(count ?? 0);
  }
}
