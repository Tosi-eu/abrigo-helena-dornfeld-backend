import bcrypt from 'bcrypt';
import { LoginRepository } from '../../infrastructure/database/repositories/login.repository';
import { jwtConfig } from '../../infrastructure/helpers/auth.helper';
import jwt from 'jsonwebtoken';
import { BaseError } from 'sequelize';
import { Login } from '../domain/login';

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
    };
  }  

  async create(attrs: Login) {

    const userExists = await this.repo.findByLogin(attrs.login);

    if (userExists) {
      throw new Error('Usuário já cadastrado');
    }

    const hashed = await bcrypt.hash(attrs.password, 10);
    try {
      return await this.repo.create({
        login: attrs.login,
        password: hashed,
        first_name: attrs.first_name,
        last_name: attrs.last_name,
      });
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
  
    const updateData: any = {};
  
    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;
  
    if (login && login !== user.login) {
      updateData.login = login;
    }
  
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
  
    try {
      const updated = await this.repo.update(userId, updateData);
  
      return {
        id: updated!.id,
        login: updated!.login,
        firstName: updated!.first_name,
        lastName: updated!.last_name,
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

  async logout(userId: number) {
    await this.repo.clearToken(userId);
  }

  async resetPassword(login: string, newPassword: string) {
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
