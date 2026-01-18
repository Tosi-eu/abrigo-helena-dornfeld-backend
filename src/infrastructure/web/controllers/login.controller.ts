import { Request, Response } from 'express';
import { LoginService } from '../../../core/services/login.service';
import { AuthRequest } from '../../../middleware/auth.middleware';
import { getErrorMessage } from '../../types/error.types';

export class LoginController {
  constructor(private readonly service: LoginService) {}

  async create(req: AuthRequest, res: Response) {
    const { login, password, first_name, last_name } = req.body;

    if (!login || !password)
      return res.status(400).json({ error: 'Login e senha obrigatórios' });

    try {
      const user = await this.service.create({
        login,
        password,
        first_name,
        last_name,
      });
      return res.status(201).json(user);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (message === 'duplicate key') {
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

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
      path: '/',
    };

    res.cookie('authToken', result.token, cookieOptions);

    return res.json({
      user: result.user,
    });
  }

  async update(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const { currentPassword, login, password, firstName, lastName } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ error: 'Senha atual é obrigatória' });
    }

    try {
      const updated = await this.service.updateUser({
        userId,
        currentPassword,
        login,
        password,
        firstName,
        lastName,
      });

      if (!updated) {
        return res.status(401).json({ error: 'Senha atual incorreta' });
      }

      return res.json(updated);
    } catch (error: unknown) {
      const message = getErrorMessage(error);

      if (message === 'duplicate key') {
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

  async resetPassword(req: Request, res: Response) {
    const { login, newPassword } = req.body;

    if (!login || !newPassword)
      return res
        .status(400)
        .json({ error: 'Login e nova senha são obrigatórios' });

    try {
      const user = await this.service.resetPassword(login, newPassword);
      return res.json(user);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erro ao redefinir senha';

      if (message === 'Login não encontrado') {
        return res.status(404).json({ error: 'Login não encontrado' });
      }

      return res.status(400).json({ error: message });
    }
  }

  async getCurrentUser(req: AuthRequest, res: Response) {
    const userId = req.user!.id;

    const user = await this.service.getById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.json(user);
  }

  async logout(req: AuthRequest, res: Response) {
    await this.service.logout(req.user!.id);

    res.clearCookie('authToken', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });

    return res.status(204).send();
  }
}
