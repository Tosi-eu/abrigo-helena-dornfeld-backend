import { Request, Response } from "express";
import { MedicamentoService } from "../../../core/services/medicamento.service";

export class MedicamentoController {
  constructor(private readonly service: MedicamentoService) {}

  async create(req: Request, res: Response) {
    try {
      const novo = await this.service.cadastrarNovo(req.body);
      res.status(201).json(novo);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async getAll(_req: Request, res: Response) {
    const lista = await this.service.listarTodos();
    res.json(lista);
  }

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    try {
      const updated = await this.service.atualizar(id, req.body);
      if (!updated) return res.status(404).json({ error: "Não encontrado" });
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async delete(req: Request, res: Response) {
    const id = Number(req.params.id);
    const ok = await this.service.remover(id);
    if (!ok) return res.status(404).json({ error: "Não encontrado" });
    res.json({ message: "Removido com sucesso" });
  }
}