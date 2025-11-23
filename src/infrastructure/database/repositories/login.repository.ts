import { LoginModel } from "../models/login.model";

export class LoginRepository {
  async create(data: { login: string; password: string }) {
    return await LoginModel.create(data);
  }

  async findByCredentials(login: string, password: string) {
    return await LoginModel.findOne({
      where: { login, password },
      attributes: ["id", "login", "password"],
    });
  }

  async findByIdAndCredentials(id: number, login: string, password: string) {
    return await LoginModel.findOne({
      where: { id, login, password },
    });
  }

  async update(id: number, data: { login: string; password: string }) {
    await LoginModel.update(data, { where: { id } });

    return await LoginModel.findByPk(id, {
      attributes: ["id", "login", "password"],
    });
  }

  async delete(id: number): Promise<boolean> {
    const count = await LoginModel.destroy({ where: { id } });
    return count > 0;
  }

  async updatePassword(login: string, newPassword: string) {
    await LoginModel.update(
      { password: newPassword },
      { where: { login } }
    );

    return await LoginModel.findOne({
      where: { login },
      attributes: ["id", "login", "password"],
    });
  }
}
