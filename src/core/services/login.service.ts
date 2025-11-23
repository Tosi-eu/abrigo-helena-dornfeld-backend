import { LoginRepository } from "../../infrastructure/database/repositories/login.repository";
import { LoginModel } from "../../infrastructure/database/models/login.model";

export class LoginService {
  constructor(private readonly repo: LoginRepository) {}

  async create(login: string, password: string): Promise<LoginModel> {
    try {
      return await this.repo.create({ login, password });
    } catch (err: any) {
      if (err.name === "SequelizeUniqueConstraintError") {
        throw new Error("duplicate key");
      }
      throw err;
    }
  }

  async authenticate(login: string, password: string): Promise<LoginModel | null> {
    return await this.repo.findByCredentials(login, password);
  }

  async updateUser(
    id: number,
    currentLogin: string,
    currentPassword: string,
    newLogin: string,
    newPassword: string
  ) {
    const exists = await this.repo.findByIdAndCredentials(
      id,
      currentLogin,
      currentPassword
    );

    if (!exists) return null;

    try {
      return await this.repo.update(id, {
        login: newLogin,
        password: newPassword,
      });
    } catch (err: any) {
      if (err.name === "SequelizeUniqueConstraintError") {
        throw new Error("duplicate key");
      }
      throw err;
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    return await this.repo.delete(id);
  }

  async resetPassword(login: string, newPassword: string) {
    const user = await this.repo.updatePassword(login, newPassword);
    return user ?? null;
  }
}
