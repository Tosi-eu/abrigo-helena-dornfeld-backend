import { Request, Response } from "express";
import { LoginService } from "../../../core/services/login.service";

export class LoginController {
  constructor(private readonly service: LoginService) {}

  async create(req: Request, res: Response) {
    const { login, password } = req.body;

    if (!login || !password)
      return res.status(400).json({ error: "Login e senha obrigatórios" });

    try {
      const user = await this.service.create(login, password);
      return res.status(201).json(user);
    } catch (err: any) {
      if (err === "duplicate key") {
        return res.status(409).json({ error: "Login já cadastrado" });
      }
      return res.status(500).json({ error: "Erro ao criar usuário" });
    }
  }

  async authenticate(req: Request, res: Response) {
    const { login, password } = req.body;

    if (!login || !password)
      return res.status(400).json({ error: "Login e senha obrigatórios" });

    const user = await this.service.authenticate(
      login as string,
      password as string
    );

    if (!user)
      return res.status(401).json({ error: "Credenciais inválidas" });

    return res.json(user);
  }

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const { currentLogin, currentPassword, login, password } = req.body;

    if (!currentLogin || !currentPassword || !login || !password)
      return res.status(400).json({ error: "Dados obrigatórios ausentes" });

    try {
      const updated = await this.service.updateUser(
        Number(id),
        currentLogin,
        String(currentPassword),
        login,
        String(password)
      );

      if (!updated)
        return res.status(401).json({ error: "Credenciais atuais incorretas" });

      return res.json(updated);
    } catch (err: any) {
      if (err.message === "duplicate key") {
        return res.status(409).json({ error: "Login já cadastrado" });
      }
      return res.status(500).json({ error: "Erro ao atualizar usuário" });
    }
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;

    const ok = await this.service.deleteUser(Number(id));

    if (!ok)
      return res.status(404).json({ error: "Usuário não encontrado" });

    return res.status(204).send();
  }

  async resetPassword(req: Request, res: Response) {
    const { login, newPassword } = req.body;

    if (!login || !newPassword)
      return res.status(400).json({ error: "Login e nova senha obrigatórios" });

    const user = await this.service.resetPassword(login, newPassword);

    if (!user)
      return res.status(404).json({ error: "Usuário não encontrado" });

    return res.json(user);
  }
}
