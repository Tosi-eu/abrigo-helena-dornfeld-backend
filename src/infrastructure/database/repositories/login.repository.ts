import { Login } from '../../../core/domain/login';
import { LoginModel } from '../models/login.model';

export class LoginRepository {
  async create(data: Login) {
    const user = await LoginModel.create({
      ...data,
    });
    return { id: user.id, login: user.login };
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
      ],
    });
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
    return LoginModel.findOne({ where: { refresh_token: token } });
  }
}
