import { Login } from '../../../core/domain/login';
import { LoginModel } from '../models/login.model';

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
  async create(data: CreateUserData) {
    let role: 'admin' | 'user' = data.role ?? 'user';
    let permissions: typeof FULL_PERMISSIONS | typeof DEFAULT_USER_PERMISSIONS =
      data.permissions ?? DEFAULT_USER_PERMISSIONS;

    if (process.env.NODE_ENV === 'test') {
      const count = await LoginModel.count();
      if (count === 0) {
        role = 'admin';
        permissions = FULL_PERMISSIONS;
      }
    }

    try {
      const user = await LoginModel.create({
        ...data,
        role,
        permissions,
      });
      return { id: user.id, login: user.login, role: user.role };
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'SequelizeUniqueConstraintError') {
        throw new Error('duplicate key');
      }
      throw err;
    }
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

  async findByLoginForTenant(login: string, tenantId: number) {
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
