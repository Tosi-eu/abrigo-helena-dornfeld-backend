import bcrypt from 'bcrypt';
import { LoginRepository } from '../../infrastructure/database/repositories/login.repository';
import { jwtConfig } from '../../infrastructure/helpers/auth.helper';
import jwt from 'jsonwebtoken';
import { BaseError } from 'sequelize';

export class LoginService {
  constructor(private readonly repo: LoginRepository) {}

  async create(login: string, password: string) {
    const hashed = await bcrypt.hash(password, 10);
    try {
      return await this.repo.create({ login, password: hashed });
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

    await this.repo.update(user.id, { refreshToken: token });

    return {
      token,
      user: {
        id: user.id,
        login: user.login,
      },
    };
  }

  async updateUser(
    id: number,
    currentLogin: string,
    currentPassword: string,
    newLogin: string,
    newPassword: string,
  ) {
    const user = await this.repo.findById(id);
    if (!user) return null;

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match || user.login !== currentLogin) return null;

    const hashed = await bcrypt.hash(newPassword, 10);

    try {
      const updated = await this.repo.update(id, {
        login: newLogin,
        password: hashed,
      });

      if (!updated) return null;

      return { id: updated.id, login: updated.login };
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

  async logout(userId: number) {
    await this.repo.clearToken(userId);
  }

  async resetPassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.repo.findById(userId);
    if (!user) return null;

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return null;

    const hashed = await bcrypt.hash(newPassword, 10);
    const updated = await this.repo.update(userId, { password: hashed });

    return { id: updated!.id, login: updated!.login };
  }
}
