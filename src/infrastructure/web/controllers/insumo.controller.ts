import { Request, Response } from "express";
import { InsumoService } from "../../../core/services/insumo.service";

export class InsumoController {
  constructor(private readonly service: InsumoService) {}

  async create(req: Request, res: Response) {
    try {
      const novo = await this.service.cadastrarNovo(req.body);
      return res.status(201).json(novo);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async getAll(_req: Request, res: Response) {
    const lista = await this.service.listarTodos();
    return res.json(lista);
  }

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    try {
      const updated = await this.service.atualizar(id, req.body);
      if (!updated) return res.status(404).json({ error: "Não encontrado" });
      return res.json(updated);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async delete(req: Request, res: Response) {
    const id = Number(req.params.id);
    const ok = await this.service.remover(id);
    if (!ok) return res.status(404).json({ error: "Não encontrado" });
    return res.json({ message: "Removido com sucesso" });
  }
}
