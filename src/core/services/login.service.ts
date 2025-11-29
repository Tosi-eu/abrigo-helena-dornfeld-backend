import bcrypt from "bcrypt";
import { LoginRepository } from "../../infrastructure/database/repositories/login.repository";
import { LoginModel } from "../../infrastructure/database/models/login.model";

export class LoginService {
  constructor(private readonly repo: LoginRepository) {}

  async create(login: string, password: string): Promise<LoginModel> {
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      return await this.repo.create({ login, password: hashedPassword });
    } catch (err: any) {
      if (err.name === "SequelizeUniqueConstraintError") {
        throw new Error("duplicate key");
      }
      throw err;
    }
  }

  async authenticate(login: string, password: string): Promise<LoginModel | null> {
    const user = await this.repo.findByLogin(login);
    if (!user) return null;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    return user;
  }

  async updateUser(
    id: number,
    currentLogin: string,
    currentPassword: string,
    newLogin: string,
    newPassword: string
  ) {
    const user = await this.repo.findById(id);
    if (!user) return null;

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch || user.login !== currentLogin) return null;

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    try {
      return await this.repo.update(id, {
        login: newLogin,
        password: hashedPassword,
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
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const user = await this.repo.findByLogin(login);
    if (!user) return null;

    return await this.repo.update(user.id, { password: hashedPassword });
  }
}
