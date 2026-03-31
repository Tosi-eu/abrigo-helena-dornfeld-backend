import type { Login } from '@porto-sdk/sdk';
import type { Transaction } from 'sequelize';
import { LoginModel } from '../models/login.model';
import { sequelize } from '../sequelize';

const FULL_PERMISSIONS = {
  read: true,
  create: true,
  update: true,
  delete: true,
};

const DEFAULT_USER_PERMISSIONS = {
  read: true,
  create: false,
  update: false,
  delete: false,
};

export type CreateUserData = Login & {
  role?: 'admin' | 'user';
  tenant_id?: number;
  is_super_admin?: boolean;
  permissions?: {
    read: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
  };
};

export class LoginRepository {
  async create(data: CreateUserData, options?: { transaction?: Transaction }) {
    const tenantId = Number(data.tenant_id) || 1;
    const transaction = options?.transaction;

    let role: 'admin' | 'user';
    let permissions: typeof FULL_PERMISSIONS | typeof DEFAULT_USER_PERMISSIONS;

    if (data.role !== undefined && data.role !== null) {
      role = data.role;
      permissions =
        data.permissions ??
        (role === 'admin' ? FULL_PERMISSIONS : DEFAULT_USER_PERMISSIONS);
    } else {
      const usersInTenant = await LoginModel.count({
        where: { tenant_id: tenantId },
        transaction,
      });
      if (usersInTenant === 0) {
        role = 'admin';
        permissions = FULL_PERMISSIONS;
      } else {
        role = 'user';
        permissions = data.permissions ?? DEFAULT_USER_PERMISSIONS;
      }
    }

    try {
      const user = await LoginModel.create(
        {
          ...data,
          role,
          permissions,
        },
        { transaction },
      );
      return { id: user.id, login: user.login, role: user.role };
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'SequelizeUniqueConstraintError') {
        throw new Error('duplicate key');
      }
      throw err;
    }
  }

  async findTenantSummariesForLogin(
    login: string,
    transaction?: Transaction,
  ): Promise<{ slug: string; label: string }[]> {
    const trimmed = login.trim();
    if (!trimmed) return [];

    const [rawRows] = await sequelize.query(
      `
      SELECT DISTINCT t.slug, t.name, t.brand_name
      FROM login l
      INNER JOIN tenant t ON t.id = l.tenant_id
      WHERE LOWER(TRIM(BOTH FROM l.login)) = LOWER(TRIM(BOTH FROM :login))
      ORDER BY t.slug ASC
      `,
      { replacements: { login: trimmed }, transaction },
    );

    const rows = rawRows as {
      slug: string;
      name: string;
      brand_name: string | null;
    }[];

    return rows.map(r => ({
      slug: r.slug,
      label: (r.brand_name && String(r.brand_name).trim()) || r.name,
    }));
  }

  async findByLogin(login: string) {
    return LoginModel.findOne({
      where: { login },
      attributes: [
        'id',
        'login',
        'password',
        'refresh_token',
        'first_name',
        'last_name',
        'role',
        'tenant_id',
        'is_super_admin',
      ],
    });
  }

  async findByLoginForTenant(
    login: string,
    tenantId: number,
    transaction?: Transaction,
  ) {
    return LoginModel.findOne({
      where: { login, tenant_id: tenantId },
      attributes: [
        'id',
        'login',
        'password',
        'refresh_token',
        'first_name',
        'last_name',
        'role',
        'tenant_id',
        'is_super_admin',
        'permissions',
      ],
      transaction,
    });
  }

  async findById(id: number) {
    return LoginModel.findByPk(id, {
      attributes: [
        'id',
        'login',
        'password',
        'refresh_token',
        'first_name',
        'last_name',
        'role',
        'permissions',
        'tenant_id',
        'is_super_admin',
      ],
    });
  }

  async findAll() {
    return LoginModel.findAll({
      attributes: [
        'id',
        'login',
        'first_name',
        'last_name',
        'role',
        'permissions',
        'tenant_id',
        'is_super_admin',
      ],
      order: [['id', 'ASC']],
    });
  }

  async listPaginated(page: number, limit: number) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
    const offset = (safePage - 1) * safeLimit;

    const [data, total] = await Promise.all([
      LoginModel.findAll({
        attributes: [
          'id',
          'login',
          'first_name',
          'last_name',
          'role',
          'permissions',
          'tenant_id',
          'is_super_admin',
        ],
        order: [['id', 'ASC']],
        limit: safeLimit,
        offset,
      }),
      LoginModel.count(),
    ]);

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async update(id: number, data: Partial<LoginModel>) {
    await LoginModel.update(data, { where: { id } });
    return this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    return (await LoginModel.destroy({ where: { id } })) > 0;
  }

  async clearToken(userId: number) {
    await LoginModel.update({ refresh_token: null }, { where: { id: userId } });
  }

  async findByToken(token: string) {
    return LoginModel.findOne({
      where: { refresh_token: token },
      attributes: [
        'id',
        'login',
        'refresh_token',
        'first_name',
        'last_name',
        'role',
        'permissions',
        'tenant_id',
        'is_super_admin',
      ],
    });
  }
}
