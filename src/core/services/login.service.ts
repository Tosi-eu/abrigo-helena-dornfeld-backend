import bcrypt from 'bcrypt';
import { LoginRepository } from '../../infrastructure/database/repositories/login.repository';
import { jwtConfig } from '../../infrastructure/helpers/auth.helper';
import jwt from 'jsonwebtoken';
import { BaseError } from 'sequelize';
import { Login } from '../domain/login';

const MIN_PASSWORD_LENGTH = 8;

const FULL_PERMISSIONS = {
  read: true,
  create: true,
  update: true,
  delete: true,
} as const;

const DEFAULT_PERMISSIONS = {
  read: true,
  create: false,
  update: false,
  delete: false,
} as const;

function effectivePermissions(
  role: 'admin' | 'user',
  stored:
    | { read?: boolean; create?: boolean; update?: boolean; delete?: boolean }
    | null
    | undefined,
) {
  if (role === 'admin') return { ...FULL_PERMISSIONS };
  return { ...DEFAULT_PERMISSIONS, ...(stored ?? {}) };
}

function validateStrongPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres`,
    );
  }
  if (!/[a-zA-Z]/.test(password)) {
    throw new Error('Senha deve conter pelo menos uma letra');
  }
  if (!/[0-9]/.test(password)) {
    throw new Error('Senha deve conter pelo menos um número');
  }
}

type UpdateUserInput = {
  userId: number;
  currentPassword: string;
  login?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
};

export class LoginService {
  constructor(private readonly repo: LoginRepository) {}

  async getById(id: number) {
    const user = await this.repo.findById(id);
    if (!user) return null;

    return {
      id: user.id,
      login: user.login,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      permissions: effectivePermissions(user.role, user.permissions),
    };
  }

  async create(attrs: Login) {
    const userExists = await this.repo.findByLogin(attrs.login);

    if (userExists) {
      throw new Error('Usuário já cadastrado');
    }

    validateStrongPassword(attrs.password);
    const hashed = await bcrypt.hash(attrs.password, 10);
    try {
      const created = await this.repo.create({
        login: attrs.login,
        password: hashed,
        first_name: attrs.first_name,
        last_name: attrs.last_name,
      });
      return created;
    } catch (err: unknown) {
      if (
        err instanceof BaseError &&
        err.name === 'SequelizeUniqueConstraintError'
      ) {
        throw new Error('duplicate key');
      }
      throw err;
    }
  }

  async createByAdmin(attrs: {
    login: string;
    password: string;
    first_name?: string;
    last_name?: string;
    role?: 'admin' | 'user';
    permissions?: {
      read?: boolean;
      create?: boolean;
      update?: boolean;
      delete?: boolean;
    };
  }) {
    const userExists = await this.repo.findByLogin(attrs.login);
    if (userExists) throw new Error('Usuário já cadastrado');

    validateStrongPassword(attrs.password);
    const hashed = await bcrypt.hash(attrs.password, 10);
    const role = attrs.role ?? 'user';
    const permissions =
      role === 'admin'
        ? { ...FULL_PERMISSIONS }
        : {
            read: true,
            create: Boolean(attrs.permissions?.create),
            update: Boolean(attrs.permissions?.update),
            delete: Boolean(attrs.permissions?.delete),
          };

    try {
      const created = await this.repo.create({
        login: attrs.login,
        password: hashed,
        first_name: attrs.first_name,
        last_name: attrs.last_name,
        role,
        permissions,
      });
      const user = await this.repo.findById(created.id);
      if (!user) return null;
      return {
        id: user.id,
        login: user.login,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        permissions: effectivePermissions(user.role, user.permissions),
      };
    } catch (err: unknown) {
      if (
        err instanceof BaseError &&
        err.name === 'SequelizeUniqueConstraintError'
      ) {
        throw new Error('duplicate key');
      }
      throw err;
    }
  }

  async authenticate(login: string, password: string) {
    const user = await this.repo.findByLogin(login);
    if (!user) return null;

    const match = await bcrypt.compare(password, user.password);
    if (!match) return null;

    const token = jwt.sign(
      { sub: user.id, login: user.login },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn },
    );

    await this.repo.update(user.id, { refresh_token: token });

    return {
      token,
      user: {
        id: user.id,
        login: user.login,
        role: user.role,
      },
    };
  }

  async updateUser({
    userId,
    currentPassword,
    login,
    password,
    firstName,
    lastName,
  }: UpdateUserInput) {
    const user = await this.repo.findById(userId);
    if (!user) return null;

    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) return null;

    const updateData: Partial<{
      first_name: string;
      last_name: string;
      login: string;
      password: string;
    }> = {};

    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;

    if (login && login !== user.login) {
      updateData.login = login;
    }

    if (password) {
      validateStrongPassword(password);
      updateData.password = await bcrypt.hash(password, 10);
    }

    try {
      const updated = await this.repo.update(userId, updateData);

      return {
        id: updated!.id,
        login: updated!.login,
        firstName: updated!.first_name,
        lastName: updated!.last_name,
        role: updated!.role,
      };
    } catch (err: unknown) {
      if (
        err instanceof BaseError &&
        err.name === 'SequelizeUniqueConstraintError'
      ) {
        throw new Error('duplicate key');
      }
      throw err;
    }
  }

  async deleteUser(id: number) {
    return this.repo.delete(id);
  }

  async listAllUsers() {
    const rows = await this.repo.findAll();
    return rows.map(u => ({
      id: u.id,
      login: u.login,
      firstName: u.first_name,
      lastName: u.last_name,
      role: u.role,
      permissions: effectivePermissions(u.role, u.permissions),
    }));
  }

  async listUsersPaginated(page = 1, limit = 25) {
    const result = await this.repo.listPaginated(page, limit);
    return {
      data: result.data.map(u => ({
        id: u.id,
        login: u.login,
        firstName: u.first_name,
        lastName: u.last_name,
        role: u.role,
        permissions: effectivePermissions(u.role, u.permissions),
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async updateUserByAdmin(
    userId: number,
    data: {
      first_name?: string;
      last_name?: string;
      login?: string;
      password?: string;
      role?: 'admin' | 'user';
      permissions?: {
        read?: boolean;
        create?: boolean;
        update?: boolean;
        delete?: boolean;
      };
    },
  ) {
    const user = await this.repo.findById(userId);
    if (!user) return null;

    const updateData: Partial<{
      first_name: string;
      last_name: string;
      login: string;
      role: 'admin' | 'user';
      password: string;
      permissions: {
        read: boolean;
        create: boolean;
        update: boolean;
        delete: boolean;
      };
    }> = {};
    if (data.first_name !== undefined) updateData.first_name = data.first_name;
    if (data.last_name !== undefined) updateData.last_name = data.last_name;
    if (data.login !== undefined) updateData.login = data.login;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.password) {
      validateStrongPassword(data.password);
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    const resultingRole = (data.role ?? user.role) as 'admin' | 'user';
    if (resultingRole === 'admin') {
      updateData.permissions = { ...FULL_PERMISSIONS };
    } else if (data.permissions !== undefined) {
      const p = data.permissions;
      updateData.permissions = {
        read: true,
        create: p.create ?? false,
        update: p.update ?? false,
        delete: p.delete ?? false,
      };
    }

    const updated = await this.repo.update(userId, updateData);
    return {
      id: updated!.id,
      login: updated!.login,
      firstName: updated!.first_name,
      lastName: updated!.last_name,
      role: updated!.role,
      permissions: effectivePermissions(updated!.role, updated!.permissions),
    };
  }

  async deleteUserByAdmin(userId: number, adminId: number) {
    if (userId === adminId) return false;
    return this.repo.delete(userId);
  }

  async logout(userId: number) {
    await this.repo.clearToken(userId);
  }

  async resetPassword(login: string, newPassword: string) {
    validateStrongPassword(newPassword);
    const user = await this.repo.findByLogin(login);
    if (!user) {
      throw new Error('Login não encontrado');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    const updated = await this.repo.update(user.id, { password: hashed });

    if (!updated) {
      throw new Error('Não foi possível resetar a senha');
    }

    return { id: updated.id, login: updated.login };
  }
}
