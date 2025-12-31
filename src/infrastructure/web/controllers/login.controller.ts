import { Response } from 'express';
import { LoginService } from '../../../core/services/login.service';
import { AuthRequest } from '../../../middleware/auth.middleware';

export class LoginController {
  constructor(private readonly service: LoginService) {}

  async create(req: AuthRequest, res: Response) {
    const { login, password } = req.body;

    if (!login || !password)
      return res.status(400).json({ error: 'Login e senha obrigatórios' });

    try {
      const user = await this.service.create(login, password);
      return res.status(201).json(user);
    } catch (err: any) {
      if (err.message === 'duplicate key') {
        return res.status(409).json({ error: 'Login já cadastrado' });
      }
      return res.status(500).json({ error: 'Erro ao criar usuário' });
    }
  }

  async authenticate(req: AuthRequest, res: Response) {
    const { login, password } = req.body;

    if (!login || !password)
      return res.status(400).json({ error: 'Login e senha obrigatórios' });

    const result = await this.service.authenticate(login, password);
    if (!result)
      return res.status(401).json({ error: 'Credenciais inválidas' });

    return res.json(result);
  }

  async update(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const { currentLogin, currentPassword, login, password } = req.body;

    if (!currentLogin || !currentPassword || !login || !password)
      return res.status(400).json({ error: 'Dados obrigatórios ausentes' });

    try {
      const updated = await this.service.updateUser(
        userId,
        currentLogin,
        currentPassword,
        login,
        password,
      );

      if (!updated)
        return res.status(401).json({ error: 'Credenciais atuais incorretas' });

      return res.json(updated);
    } catch (err: any) {
      if (err.message === 'duplicate key') {
        return res.status(409).json({ error: 'Login já cadastrado' });
      }
      return res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
  }

  async delete(req: AuthRequest, res: Response) {
    const ok = await this.service.deleteUser(req.user!.id);
    if (!ok) return res.status(404).json({ error: 'Usuário não encontrado' });

    return res.status(204).send();
  }

  async resetPassword(req: AuthRequest, res: Response) {
    const { login, newPassword } = req.body;

    if (!login || !newPassword)
      return res.status(400).json({ error: 'Login e nova senha obrigatórios' });

    const user = await this.service.resetPassword(login, newPassword);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    return res.json(user);
  }

  async logout(req: AuthRequest, res: Response) {
    await this.service.logout(req.user!.id);
    return res.status(204).send();
  }
}
