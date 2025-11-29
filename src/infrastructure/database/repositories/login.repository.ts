import { LoginModel } from "../models/login.model";

export class LoginRepository {
  async create(data: { login: string; password: string }) {
    return await LoginModel.create(data);
  }

  async findByLogin(login: string) {
    return await LoginModel.findOne({
      where: { login },
      attributes: ["id", "login", "password"],
    });
  }

  async findById(id: number) {
    return await LoginModel.findByPk(id, {
      attributes: ["id", "login", "password"],
    });
  }

  async update(id: number, data: { login?: string; password?: string }) {
    await LoginModel.update(data, { where: { id } });
    return await this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const count = await LoginModel.destroy({ where: { id } });
    return count > 0;
  }
}
